import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getPaddleEnvironment } from "./paddle";

const ScanInput = z.object({
  subjectId: z.string().uuid(),
  targetTopicId: z.string().uuid(),
});

const ClassifyInput = z.object({
  actionId: z.string().uuid(),
  items: z
    .array(z.object({
      id: z.string().uuid(),
      q: z.string().max(600),
      a: z.string().max(900),
    }))
    .min(1)
    .max(30),
});

const CopyInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  targetTopicId: z.string().uuid(),
});

/** Busca paginada de todos os cards da matéria e aplica o pré-filtro por palavras-chave. */
export const scanPrazoCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ScanInput.parse(data))
  .handler(async ({ data, context }) => {
    const { PRAZOS_THEME, normalizeQuestion } = await import("./prazos-scan.server");
    const sb = context.supabase;

    const { data: topics, error: tErr } = await sb
      .from("topics")
      .select("id")
      .eq("subject_id", data.subjectId);
    if (tErr) throw new Error(tErr.message);
    const topicIds = (topics ?? []).map((t) => t.id);
    if (topicIds.length === 0) return { candidates: [], total: 0, existing: 0 };

    const all: Array<{ id: string; question: string; answer: string; topic_id: string }> = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: rows, error } = await sb
        .from("flashcards")
        .select("id,question,answer,topic_id")
        .in("topic_id", topicIds)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const batch = rows ?? [];
      all.push(...batch);
      if (batch.length < PAGE) break;
    }

    const existingKeys = new Set(
      all
        .filter((r) => r.topic_id === data.targetTopicId)
        .map((r) => normalizeQuestion(r.question)),
    );

    const candidates = all
      .filter((r) => r.topic_id !== data.targetTopicId)
      .filter((r) => PRAZOS_THEME.keywords.test(`${r.question} ${r.answer}`))
      .filter((r) => !existingKeys.has(normalizeQuestion(r.question)))
      .map((r) => ({ id: r.id, q: r.question, a: r.answer.slice(0, 1200) }));

    return { candidates, total: all.length, existing: existingKeys.size };
  });

/** Classifica um lote de candidatos com o PilotAI e devolve os ids aprovados. */
export const classifyPrazoBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ClassifyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { PRAZOS_THEME, buildClassificationPrompt, classifyWithGateway } = await import(
      "./prazos-scan.server"
    );
    const { runWithAiQuota } = await import("./ai-quota.server");
    const cache = await import("./ai-result-cache.server");
    const prompt = buildClassificationPrompt(PRAZOS_THEME);
    const keyed = await Promise.all(
      data.items.map(async (i) => ({
        item: i,
        key: await cache.aiCacheKey("prazos-scan", prompt, i.q, i.a),
      })),
    );
    const verdicts = new Map<string, boolean>();
    await Promise.all(
      keyed.map(async ({ item, key }) => {
        const hit = await cache.readAiCache<{ match: boolean }>(key);
        if (hit) verdicts.set(item.id, hit.match);
      }),
    );
    const pending = keyed.filter(({ item }) => !verdicts.has(item.id));
    if (pending.length) {
      const fresh = await runWithAiQuota(
        {
          userId: context.userId,
          actionId: data.actionId,
          jobId: data.actionId,
          resource: "flashcards_job",
          units: 1,
        },
        (_, signal) =>
          classifyWithGateway(
            prompt,
            pending.map(({ item }) => ({ id: item.id, q: item.q, a: item.a })),
            signal,
          ),
      );
      await Promise.all(
        pending.map(async ({ item, key }) => {
          const match = fresh.has(item.id);
          verdicts.set(item.id, match);
          await cache.writeAiCache("prazos-scan", key, { match });
        }),
      );
    }
    return { approved: data.items.filter((i) => verdicts.get(i.id)).map((i) => i.id) };
  });

/** Cria cópias independentes dos cards aprovados no tópico de destino. */
export const copyPrazoCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CopyInput.parse(data))
  .handler(async ({ data, context }) => {
    const { normalizeQuestion } = await import("./prazos-scan.server");
    const sb = context.supabase;

    const { data: existing, error: exErr } = await sb
      .from("flashcards")
      .select("question")
      .eq("topic_id", data.targetTopicId);
    if (exErr) throw new Error(exErr.message);
    const existingKeys = new Set((existing ?? []).map((r) => normalizeQuestion(r.question)));

    const { data: src, error: sErr } = await sb
      .from("flashcards")
      .select(
        "question,answer,question_original,answer_original,card_format,image_url,image_category_id,linked_note_id,video_url_1,video_url_2",
      )
      .in("id", data.ids);
    if (sErr) throw new Error(sErr.message);

    const noteIds = [...new Set((src ?? []).flatMap((card) => card.linked_note_id ? [card.linked_note_id] : []))];
    const categoryIds = [...new Set((src ?? []).flatMap((card) => card.image_category_id ? [card.image_category_id] : []))];
    const [{ data: ownedNotes, error: notesError }, { data: ownedCategories, error: categoriesError }] =
      await Promise.all([
        noteIds.length
          ? sb.from("notes").select("id").eq("user_id", context.userId).in("id", noteIds)
          : Promise.resolve({ data: [], error: null }),
        categoryIds.length
          ? sb.from("note_categories").select("id").eq("user_id", context.userId).in("id", categoryIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (notesError) throw new Error(notesError.message);
    if (categoriesError) throw new Error(categoriesError.message);
    const ownedNoteIds = new Set((ownedNotes ?? []).map((note) => note.id));
    const ownedCategoryIds = new Set((ownedCategories ?? []).map((category) => category.id));

    const rows = (src ?? [])
      .filter((r) => {
        const key = normalizeQuestion(r.question);
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      })
      .map((r) => ({
        user_id: context.userId,
        topic_id: data.targetTopicId,
        question: r.question,
        answer: r.answer,
        question_original: r.question_original,
        answer_original: r.answer_original,
        card_format: r.card_format,
        image_url: r.image_url,
        image_category_id:
          r.image_category_id && ownedCategoryIds.has(r.image_category_id)
            ? r.image_category_id
            : null,
        linked_note_id: r.linked_note_id && ownedNoteIds.has(r.linked_note_id) ? r.linked_note_id : null,
        video_url_1: r.video_url_1,
        video_url_2: r.video_url_2,
        reviewed: false,
      }));

    if (rows.length === 0) return { inserted: 0, skipped: (src ?? []).length };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: saved, error: saveError } = await supabaseAdmin.rpc(
      "save_flashcards_atomically",
      {
        p_user_id: context.userId,
        p_action_id: crypto.randomUUID(),
        p_environment: getPaddleEnvironment(),
        p_cards: rows.map((row) => ({
          topic_id: row.topic_id,
          question: row.question,
          answer: row.answer,
          question_original: row.question_original,
          answer_original: row.answer_original,
          card_format: row.card_format,
          reviewed: false,
          image_url: row.image_url,
          image_category_id: row.image_category_id,
          linked_note_id: row.linked_note_id,
          video_url_1: row.video_url_1,
          video_url_2: row.video_url_2,
          generated_job_id: null,
        })),
      },
    );
    if (saveError) throw new Error(saveError.message);
    const inserted = saved?.[0]?.inserted_count ?? 0;
    return { inserted, skipped: (src ?? []).length - inserted };
  });
