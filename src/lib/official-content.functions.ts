import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Entrega de matéria comprada como CÓPIA do aluno.
 *
 * Regras:
 * - Na compra, a matéria inteira do autor é copiada para a conta do aluno (editável).
 * - Cada item copiado guarda `source_id` (item de origem) e `source_synced_at`.
 * - Quando o aluno edita um item, o trigger `mark_user_modified` marca `user_modified = true`
 *   e as atualizações do autor nunca mais sobrescrevem aquele item.
 * - Na renovação, o aluno escolhe: `keep` (mantém as alterações dele) ou
 *   `overwrite` (recebe tudo do autor novamente).
 */

const MINDMAP_BUCKET = "flashcard-mindmaps";
const CHUNK = 500;
/** Evita que o cliente dispare re-sincronizações completas em sequência (custo de leitura/gravação). */
const SYNC_COOLDOWN_MS = 30_000;

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function insertChunks(admin: Admin, table: string, rows: any[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await (admin.from(table as any) as any).insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

/** Todo o conteúdo da matéria de origem, já organizado. */
async function loadSource(admin: Admin, subjectId: string) {
  const { data: subject } = await admin
    .from("subjects")
    .select("id, user_id, name, color, language, order_index")
    .eq("id", subjectId)
    .maybeSingle();
  if (!subject) throw new Error("Matéria não encontrada.");

  const { data: topics } = await admin
    .from("topics")
    .select("id, subject_id, name, parent_id, order_index, review_enabled, article_range")
    .eq("subject_id", subjectId);
  const topicIds = (topics ?? []).map((t) => t.id);

  const flashcards: any[] = [];
  if (topicIds.length) {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data } = await admin
        .from("flashcards")
        .select(
          "id, topic_id, question, answer, question_original, answer_original, card_format, conversion_reason, image_url, image_category_id, linked_note_id, video_url_1, video_url_2, language, order_index",
        )
        .in("topic_id", topicIds)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      flashcards.push(...(data ?? []));
      if ((data ?? []).length < PAGE) break;
    }
  }

  const orFilter = [
    `subject_id.eq.${subjectId}`,
    topicIds.length ? `topic_id.in.(${topicIds.join(",")})` : "",
  ]
    .filter(Boolean)
    .join(",");
  const { data: rootCats } = await admin
    .from("note_categories")
    .select("id, user_id, name, parent_id, subject_id, topic_id")
    .or(orFilter);

  // Subpastas criadas pelo autor dentro das pastas espelho (podem ter vários níveis).
  const cats = [...(rootCats ?? [])];
  const seen = new Set(cats.map((c) => c.id));
  for (let guard = 0; guard < 12; guard++) {
    const parents = cats.map((c) => c.id);
    if (!parents.length) break;
    const { data: children } = await admin
      .from("note_categories")
      .select("id, user_id, name, parent_id, subject_id, topic_id")
      .in("parent_id", parents);
    const fresh = (children ?? []).filter((c) => !seen.has(c.id));
    if (!fresh.length) break;
    for (const c of fresh) {
      seen.add(c.id);
      cats.push(c);
    }
  }
  const catIds = cats.map((c) => c.id);

  const notes = catIds.length
    ? (
        await admin
          .from("notes")
          .select("id, title, content_html, category_id")
          .in("category_id", catIds)
      ).data ?? []
    : [];
  const noteIds = notes.map((n) => n.id);

  const media: any[] = [];
  if (catIds.length) {
    const { data } = await admin
      .from("note_media")
      .select("id, category_id, note_id, kind, title, storage_path, url, order_index")
      .in("category_id", catIds);
    media.push(...(data ?? []));
  }
  if (noteIds.length) {
    const { data } = await admin
      .from("note_media")
      .select("id, category_id, note_id, kind, title, storage_path, url, order_index")
      .in("note_id", noteIds);
    for (const m of data ?? []) if (!media.some((x) => x.id === m.id)) media.push(m);
  }

  // Games oficiais (FlashMatch) aprovados na curadoria, com as rodadas.
  const games: Array<{
    id: string;
    topic_id: string;
    title: string;
    language: string | null;
    kind: string;
    rounds: Array<{ position: number; payload: unknown }>;
  }> = [];
  if (topicIds.length) {
    const { data: decks } = await admin
      .from("game_decks")
      .select("id, topic_id, title, language, kind")
      .eq("is_official", true)
      .in("topic_id", topicIds);
    const deckIds = (decks ?? []).map((d) => d.id);
    const { data: rounds } = deckIds.length
      ? await admin.from("game_rounds").select("deck_id, position, payload").in("deck_id", deckIds)
      : { data: [] as Array<{ deck_id: string; position: number; payload: unknown }> };
    for (const deck of decks ?? []) {
      games.push({
        ...deck,
        rounds: (rounds ?? [])
          .filter((r) => r.deck_id === deck.id)
          .map((r) => ({ position: r.position, payload: r.payload })),
      });
    }
  }

  return { subject, topics: topics ?? [], cats, notes, media, flashcards, games };
}

/**
 * Entrega os FlashMatch oficiais ao aluno. Idempotente: uma cópia por game (índice único
 * user_id + source_id), rodadas gravadas sem duplicar e cópias de games removidos na origem apagadas.
 */
async function syncOfficialGames(
  admin: Admin,
  userId: string,
  games: Awaited<ReturnType<typeof loadSource>>["games"],
  topicIdMap: Map<string, string>,
  copyTopicIds: string[],
) {
  const { data: existing } = copyTopicIds.length
    ? await admin
        .from("game_decks")
        .select("id, source_id")
        .eq("user_id", userId)
        .not("source_id", "is", null)
        .in("topic_id", copyTopicIds)
    : { data: [] as Array<{ id: string; source_id: string | null }> };
  const have = new Set((existing ?? []).map((d) => d.source_id));
  for (const game of games) {
    const topicId = topicIdMap.get(game.topic_id);
    if (!topicId || !game.rounds.length) continue;
    if (!have.has(game.id)) {
      await admin.from("game_decks").upsert(
        {
          user_id: userId,
          topic_id: topicId,
          kind: game.kind,
          title: game.title,
          language: game.language,
          is_official: false,
          source_id: game.id,
        },
        { onConflict: "user_id,source_id", ignoreDuplicates: true },
      );
    }
    const { data: deck } = await admin
      .from("game_decks")
      .select("id")
      .eq("user_id", userId)
      .eq("source_id", game.id)
      .maybeSingle();
    if (!deck) continue;
    await admin.from("game_rounds").upsert(
      game.rounds.map((r) => ({
        deck_id: deck.id,
        user_id: userId,
        position: r.position,
        payload: r.payload as never,
      })),
      { onConflict: "deck_id,position", ignoreDuplicates: true },
    );
  }
  const officialIds = new Set(games.map((g) => g.id));
  const stale = (existing ?? []).filter((d) => d.source_id && !officialIds.has(d.source_id));
  if (stale.length) {
    await admin
      .from("game_decks")
      .delete()
      .in(
        "id",
        stale.map((d) => d.id),
      );
  }
}

/** Copia o arquivo da imagem para a pasta do aluno (mesmo bucket). */
async function copyImage(admin: Admin, path: string | null, userId: string): Promise<string | null> {
  if (!path) return null;
  const parts = path.split("/");
  if (parts.length < 2) return path;
  const dest = [userId, ...parts.slice(1)].join("/");
  if (dest === path) return path;
  const { error } = await admin.storage.from(MINDMAP_BUCKET).copy(path, dest);
  if (error && !/exists/i.test(error.message)) return path; // sem cópia, mantém o original
  return dest;
}

async function syncGrant(
  admin: Admin,
  grant: { id: string; user_id: string; source_subject_id: string; copy_subject_id: string | null },
  mode: "keep" | "overwrite",
) {
  const userId = grant.user_id;
  const src = await loadSource(admin, grant.source_subject_id);
  const now = new Date().toISOString();

  // ---- Matéria (cria na primeira entrega) ----
  let copySubjectId = grant.copy_subject_id;
  if (!copySubjectId) {
    const { data, error } = await admin
      .from("subjects")
      .insert({
        user_id: userId,
        name: src.subject.name,
        color: src.subject.color,
        language: src.subject.language,
        source_id: src.subject.id,
        source_synced_at: now,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    // Reserva atômica: se outra entrega simultânea já criou a cópia, descarta esta.
    const { data: claimed } = await admin
      .from("subject_grants")
      .update({ copy_subject_id: data.id })
      .eq("id", grant.id)
      .is("copy_subject_id", null)
      .select("id");
    if (claimed && claimed.length) {
      copySubjectId = data.id;
    } else {
      await admin.from("subjects").delete().eq("id", data.id).eq("user_id", userId);
      const { data: g } = await admin.from("subject_grants").select("copy_subject_id").eq("id", grant.id).single();
      copySubjectId = g?.copy_subject_id ?? null;
      if (!copySubjectId) throw new Error("Não foi possível registrar a cópia da matéria.");
    }
  } else {
    // Defesa em profundidade: mesmo que copy_subject_id seja adulterado (a trava de
    // colunas na migration deveria impedir isso), a matéria só é lida/gravada se
    // pertencer de fato a este aluno — nunca a de outra conta.
    const { data: cur } = await admin
      .from("subjects")
      .select("user_modified")
      .eq("id", copySubjectId)
      .eq("user_id", userId)
      .maybeSingle();
    if (cur && (mode === "overwrite" || !cur.user_modified)) {
      await admin
        .from("subjects")
        .update({
          name: src.subject.name,
          color: src.subject.color,
          language: src.subject.language,
          source_synced_at: now,
          ...(mode === "overwrite" ? { user_modified: false } : {}),
        })
        .eq("id", copySubjectId)
        .eq("user_id", userId);
    }
  }

  const copyable = (row: { user_modified: boolean }) => mode === "overwrite" || !row.user_modified;
  const resetFlag = mode === "overwrite" ? { user_modified: false } : {};

  // ---- Assuntos ----
  const { data: existingTopics } = await admin
    .from("topics")
    .select("id, source_id, user_modified, parent_id")
    .eq("user_id", userId)
    .eq("subject_id", copySubjectId);
  const topicBySource = new Map<string, { id: string; user_modified: boolean }>();
  for (const t of existingTopics ?? []) if (t.source_id) topicBySource.set(t.source_id, t);

  const newTopics = src.topics.filter((t) => !topicBySource.has(t.id));
  const topicIdMap = new Map<string, string>();
  for (const [sourceId, row] of topicBySource) topicIdMap.set(sourceId, row.id);
  for (const t of newTopics) topicIdMap.set(t.id, crypto.randomUUID());

  if (newTopics.length) {
    await insertChunks(
      admin,
      "topics",
      newTopics.map((t) => ({
        id: topicIdMap.get(t.id)!,
        user_id: userId,
        subject_id: copySubjectId,
        name: t.name,
        parent_id: t.parent_id ? (topicIdMap.get(t.parent_id) ?? null) : null,
        order_index: t.order_index,
        review_enabled: t.review_enabled,
        article_range: t.article_range,
        source_id: t.id,
        source_synced_at: now,
      })),
    );
  }
  for (const t of src.topics) {
    const existing = topicBySource.get(t.id);
    if (!existing || !copyable(existing)) continue;
    await admin
      .from("topics")
      .update({
        name: t.name,
        parent_id: t.parent_id ? (topicIdMap.get(t.parent_id) ?? null) : null,
        article_range: t.article_range,
        source_synced_at: now,
        ...resetFlag,
      })
      .eq("id", existing.id);
  }
  // Assuntos removidos na origem e não alterados pelo aluno.
  const sourceTopicIds = new Set(src.topics.map((t) => t.id));
  const staleTopics = (existingTopics ?? []).filter(
    (t) => t.source_id && !sourceTopicIds.has(t.source_id) && (mode === "overwrite" || !t.user_modified),
  );
  if (staleTopics.length) {
    await admin
      .from("topics")
      .delete()
      .in(
        "id",
        staleTopics.map((t) => t.id),
      );
  }

  // ---- Pastas de anotações ----
  // Pastas espelho (ligadas a matéria/assunto) são criadas automaticamente por trigger:
  // basta localizá-las e marcar a origem.
  const copyTopicIds = Array.from(topicIdMap.values());
  const { data: mirrorCats } = await admin
    .from("note_categories")
    .select("id, subject_id, topic_id, source_id, user_modified, parent_id, name")
    .eq("user_id", userId)
    .or(
      [`subject_id.eq.${copySubjectId}`, copyTopicIds.length ? `topic_id.in.(${copyTopicIds.join(",")})` : ""]
        .filter(Boolean)
        .join(","),
    );
  const catIdMap = new Map<string, string>();
  const existingCatBySource = new Map<string, { id: string; user_modified: boolean }>();
  for (const c of mirrorCats ?? []) {
    if (c.source_id) existingCatBySource.set(c.source_id, c);
  }
  const mirrorByCopySubject = new Map<string, string>();
  const mirrorByCopyTopic = new Map<string, string>();
  for (const c of mirrorCats ?? []) {
    if (c.subject_id) mirrorByCopySubject.set(c.subject_id, c.id);
    if (c.topic_id) mirrorByCopyTopic.set(c.topic_id, c.id);
  }
  for (const c of src.cats) {
    if (c.subject_id === src.subject.id) {
      const id = mirrorByCopySubject.get(copySubjectId);
      if (id) catIdMap.set(c.id, id);
    } else if (c.topic_id) {
      const copyTopic = topicIdMap.get(c.topic_id);
      const id = copyTopic ? mirrorByCopyTopic.get(copyTopic) : undefined;
      if (id) catIdMap.set(c.id, id);
    }
  }
  // Marca a origem nas pastas espelho (para futuras sincronizações).
  for (const [sourceId, copyId] of catIdMap) {
    if (!existingCatBySource.has(sourceId)) {
      await admin.from("note_categories").update({ source_id: sourceId, source_synced_at: now }).eq("id", copyId);
    }
  }

  // Subpastas livres do autor.
  const freeCats = src.cats.filter((c) => !c.subject_id && !c.topic_id);
  const { data: existingFree } = await admin
    .from("note_categories")
    .select("id, source_id, user_modified")
    .eq("user_id", userId)
    .not("source_id", "is", null);
  const freeBySource = new Map<string, { id: string; user_modified: boolean }>();
  for (const c of existingFree ?? []) if (c.source_id) freeBySource.set(c.source_id, c);
  const newFree = freeCats.filter((c) => !freeBySource.has(c.id) && !catIdMap.has(c.id));
  for (const c of newFree) catIdMap.set(c.id, crypto.randomUUID());
  for (const [sourceId, row] of freeBySource) if (!catIdMap.has(sourceId)) catIdMap.set(sourceId, row.id);

  if (newFree.length) {
    await insertChunks(
      admin,
      "note_categories",
      newFree.map((c) => ({
        id: catIdMap.get(c.id)!,
        user_id: userId,
        name: c.name,
        parent_id: c.parent_id ? (catIdMap.get(c.parent_id) ?? null) : null,
        source_id: c.id,
        source_synced_at: now,
      })),
    );
  }
  for (const c of freeCats) {
    const existing = freeBySource.get(c.id);
    if (!existing || !copyable(existing)) continue;
    await admin
      .from("note_categories")
      .update({
        name: c.name,
        parent_id: c.parent_id ? (catIdMap.get(c.parent_id) ?? null) : null,
        source_synced_at: now,
        ...resetFlag,
      })
      .eq("id", existing.id);
  }

  // ---- Anotações ----
  const allCopyCatIds = Array.from(catIdMap.values());
  const { data: existingNotes } = allCopyCatIds.length
    ? await admin
        .from("notes")
        .select("id, source_id, user_modified")
        .eq("user_id", userId)
        .not("source_id", "is", null)
        .in("category_id", allCopyCatIds)
    : { data: [] as any[] };
  const noteBySource = new Map<string, { id: string; user_modified: boolean }>();
  for (const n of existingNotes ?? []) if (n.source_id) noteBySource.set(n.source_id, n);

  const noteIdMap = new Map<string, string>();
  for (const [sourceId, row] of noteBySource) noteIdMap.set(sourceId, row.id);
  const newNotes = src.notes.filter((n) => !noteBySource.has(n.id));
  for (const n of newNotes) noteIdMap.set(n.id, crypto.randomUUID());

  if (newNotes.length) {
    await insertChunks(
      admin,
      "notes",
      newNotes.map((n) => ({
        id: noteIdMap.get(n.id)!,
        user_id: userId,
        title: n.title,
        content_html: n.content_html,
        category_id: n.category_id ? (catIdMap.get(n.category_id) ?? null) : null,
        source_id: n.id,
        source_synced_at: now,
      })),
    );
  }
  for (const n of src.notes) {
    const existing = noteBySource.get(n.id);
    if (!existing || !copyable(existing)) continue;
    await admin
      .from("notes")
      .update({
        title: n.title,
        content_html: n.content_html,
        category_id: n.category_id ? (catIdMap.get(n.category_id) ?? null) : null,
        source_synced_at: now,
        ...resetFlag,
      })
      .eq("id", existing.id);
  }
  const sourceNoteIds = new Set(src.notes.map((n) => n.id));
  const staleNotes = (existingNotes ?? []).filter(
    (n) => n.source_id && !sourceNoteIds.has(n.source_id) && (mode === "overwrite" || !n.user_modified),
  );
  if (staleNotes.length) {
    await admin
      .from("notes")
      .delete()
      .in(
        "id",
        staleNotes.map((n) => n.id),
      );
  }

  // ---- Mídias (imagens e mapas mentais) ----
  const { data: existingMedia } = await admin
    .from("note_media")
    .select("id, source_id, user_modified")
    .eq("user_id", userId)
    .not("source_id", "is", null);
  const mediaBySource = new Map<string, { id: string; user_modified: boolean }>();
  for (const m of existingMedia ?? []) if (m.source_id) mediaBySource.set(m.source_id, m);

  const newMedia = src.media.filter((m) => !mediaBySource.has(m.id));
  const mediaRows: any[] = [];
  for (const m of newMedia) {
    mediaRows.push({
      id: crypto.randomUUID(),
      user_id: userId,
      category_id: m.category_id ? (catIdMap.get(m.category_id) ?? null) : null,
      note_id: m.note_id ? (noteIdMap.get(m.note_id) ?? null) : null,
      kind: m.kind,
      title: m.title,
      storage_path: await copyImage(admin, m.storage_path, userId),
      url: m.url,
      order_index: m.order_index,
      source_id: m.id,
      source_synced_at: now,
    });
  }
  if (mediaRows.length) await insertChunks(admin, "note_media", mediaRows);
  for (const m of src.media) {
    const existing = mediaBySource.get(m.id);
    if (!existing || !copyable(existing)) continue;
    await admin
      .from("note_media")
      .update({
        title: m.title,
        url: m.url,
        storage_path: await copyImage(admin, m.storage_path, userId),
        category_id: m.category_id ? (catIdMap.get(m.category_id) ?? null) : null,
        note_id: m.note_id ? (noteIdMap.get(m.note_id) ?? null) : null,
        source_synced_at: now,
        ...resetFlag,
      })
      .eq("id", existing.id);
  }

  // ---- Flashcards ----
  const { data: existingCards } = copyTopicIds.length
    ? await admin
        .from("flashcards")
        .select("id, source_id, user_modified")
        .eq("user_id", userId)
        .not("source_id", "is", null)
        .in("topic_id", copyTopicIds)
    : { data: [] as any[] };
  const cardBySource = new Map<string, { id: string; user_modified: boolean }>();
  for (const c of existingCards ?? []) if (c.source_id) cardBySource.set(c.source_id, c);

  const today = new Date().toISOString().slice(0, 10);
  const newCards = src.flashcards.filter((c) => !cardBySource.has(c.id));
  const cardRows: any[] = [];
  for (const c of newCards) {
    const topicId = topicIdMap.get(c.topic_id);
    if (!topicId) continue;
    cardRows.push({
      id: crypto.randomUUID(),
      user_id: userId,
      topic_id: topicId,
      question: c.question,
      answer: c.answer,
      question_original: c.question_original,
      answer_original: c.answer_original,
      card_format: c.card_format,
      conversion_reason: c.conversion_reason,
      image_url: await copyImage(admin, c.image_url, userId),
      image_category_id: c.image_category_id ? (catIdMap.get(c.image_category_id) ?? null) : null,
      linked_note_id: c.linked_note_id ? (noteIdMap.get(c.linked_note_id) ?? null) : null,
      video_url_1: c.video_url_1,
      video_url_2: c.video_url_2,
      language: c.language,
      order_index: c.order_index,
      due_date: today,
      source_id: c.id,
      source_synced_at: now,
    });
  }
  if (cardRows.length) await insertChunks(admin, "flashcards", cardRows);

  for (const c of src.flashcards) {
    const existing = cardBySource.get(c.id);
    if (!existing || !copyable(existing)) continue;
    const topicId = topicIdMap.get(c.topic_id);
    await admin
      .from("flashcards")
      .update({
        topic_id: topicId ?? undefined,
        question: c.question,
        answer: c.answer,
        question_original: c.question_original,
        answer_original: c.answer_original,
        card_format: c.card_format,
        image_url: await copyImage(admin, c.image_url, userId),
        image_category_id: c.image_category_id ? (catIdMap.get(c.image_category_id) ?? null) : null,
        linked_note_id: c.linked_note_id ? (noteIdMap.get(c.linked_note_id) ?? null) : null,
        video_url_1: c.video_url_1,
        video_url_2: c.video_url_2,
        source_synced_at: now,
        ...resetFlag,
      })
      .eq("id", existing.id);
  }
  const sourceCardIds = new Set(src.flashcards.map((c) => c.id));
  const staleCards = (existingCards ?? []).filter(
    (c) => c.source_id && !sourceCardIds.has(c.source_id) && (mode === "overwrite" || !c.user_modified),
  );
  if (staleCards.length) {
    for (let i = 0; i < staleCards.length; i += CHUNK) {
      await admin
        .from("flashcards")
        .delete()
        .in(
          "id",
          staleCards.slice(i, i + CHUNK).map((c) => c.id),
        );
    }
  }

  await syncOfficialGames(admin, userId, src.games, topicIdMap, copyTopicIds);

  // Remove cópias duplicadas da mesma matéria criadas por entregas antigas concorrentes.
  await admin
    .from("subjects")
    .delete()
    .eq("user_id", userId)
    .eq("source_id", grant.source_subject_id)
    .neq("id", copySubjectId);

  await admin
    .from("subject_grants")
    .update({ last_synced_at: now, copy_subject_id: copySubjectId })
    .eq("id", grant.id);

  return {
    copySubjectId,
    added: newCards.length,
    keptByStudent: (existingCards ?? []).filter((c) => c.user_modified).length,
  };
}

/** Garante que o aluno tenha a cópia da matéria comprada e traga as atualizações permitidas. */
export const ensureSubjectDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        productId: z.string().min(1),
        mode: z.enum(["keep", "overwrite"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const admin = await getAdmin();
    return deliverSubjectForUser(admin, context.userId, data.productId, data.mode);
  });

/** Ambientes de compra aceitos (teste incluído, salvo quando desligado), iguais aos da tela de Conta. */
export function purchaseEnvironments(): string[] {
  return ["live", "owner", ...(process.env.PADDLE_ENV_INCLUDE_SANDBOX === "0" ? [] : ["sandbox"])];
}

/**
 * Entrega no servidor (sem depender da Loja aberta): usada logo após o pagamento,
 * pela tela de Revisão e pelo botão da Loja.
 */
export async function deliverSubjectForUser(
  admin: Admin,
  userId: string,
  productId: string,
  requestedMode?: "keep" | "overwrite",
) {
    const { data: product } = await admin
      .from("store_products")
      .select("id, access_subject_id, kind")
      .eq("id", productId)
      .maybeSingle();
    if (!product?.access_subject_id) throw new Error("Produto não é uma matéria.");

    const { data: purchase } = await admin
      .from("user_purchases")
      .select("id, expires_at")
      .eq("user_id", userId)
      .eq("product_id", product.id)
      .in("environment", purchaseEnvironments())
      .is("refunded_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!purchase) throw new Error("Acesso a esta matéria não está ativo.");

    const { data: grant } = await admin
      .from("subject_grants")
      .upsert(
        {
          user_id: userId,
          product_id: product.id,
          source_subject_id: product.access_subject_id,
        },
        { onConflict: "user_id,source_subject_id" },
      )
      .select("id, user_id, source_subject_id, copy_subject_id, renew_mode, last_synced_at")
      .single();
    if (!grant) throw new Error("Não foi possível registrar o acesso.");

    const { error: expiryError } = await admin.rpc("extend_subject_grant", {
      p_user_id: userId,
      p_product_id: product.id,
      p_expires_at: purchase.expires_at,
    });
    if (expiryError) {
      throw new Error(`Não foi possível atualizar a validade: ${expiryError.message}`);
    }

    const mode = requestedMode ?? ((grant.renew_mode as "keep" | "overwrite") ?? "keep");

    if (grant.copy_subject_id && grant.last_synced_at) {
      const elapsed = Date.now() - new Date(grant.last_synced_at).getTime();
      if (elapsed < SYNC_COOLDOWN_MS) {
        return { copySubjectId: grant.copy_subject_id, added: 0, keptByStudent: 0 };
      }
    }

    const result = await syncGrant(admin, grant as any, mode);

    if (mode === "overwrite") {
      await admin.from("subject_grants").update({ renew_mode: "keep" }).eq("id", grant.id);
    }
    return result;
}

/** Tela de Revisão: entrega matérias pagas que ainda não chegaram à conta do aluno. */
export const deliverPendingSubjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await getAdmin();
    const { data: purchases } = await admin
      .from("user_purchases")
      .select("product_id")
      .eq("user_id", context.userId)
      .in("environment", purchaseEnvironments())
      .is("refunded_at", null)
      .gt("expires_at", new Date().toISOString());
    const productIds = [...new Set((purchases ?? []).map((p) => p.product_id))];
    if (!productIds.length) return { delivered: 0 };
    const { data: grants } = await admin
      .from("subject_grants")
      .select("product_id, copy_subject_id, source_subject_id")
      .eq("user_id", context.userId)
      .in("product_id", productIds);
    // Limpa cópias duplicadas deixadas por entregas antigas concorrentes.
    for (const g of grants ?? []) {
      if (!g.copy_subject_id || !g.source_subject_id) continue;
      await admin
        .from("subjects")
        .delete()
        .eq("user_id", context.userId)
        .eq("source_id", g.source_subject_id)
        .neq("id", g.copy_subject_id)
        .then(({ error }) => {
          if (error) console.error("[delivery] limpeza de duplicadas falhou", error.message);
        });
    }
    const done = new Set((grants ?? []).filter((g) => g.copy_subject_id).map((g) => g.product_id));
    let delivered = 0;
    for (const id of productIds) {
      if (done.has(id)) continue;
      try {
        await deliverSubjectForUser(admin, context.userId, id);
        delivered += 1;
      } catch (e) {
        console.error("[delivery] falha ao entregar matéria", { productId: id, error: (e as Error).message });
      }
    }
    return { delivered };
  });

/** Registra a escolha do aluno na renovação (antes do checkout). */
export const setRenewMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ productId: z.string().min(1), mode: z.enum(["keep", "overwrite"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("subject_grants")
      .update({ renew_mode: data.mode })
      .eq("user_id", context.userId)
      .eq("product_id", data.productId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Situação das matérias entregues ao aluno (para a Loja e "Minha conta"). */
export const mySubjectGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("subject_grants")
      .select("id, product_id, source_subject_id, copy_subject_id, renew_mode, last_synced_at, expires_at")
      .eq("user_id", context.userId);
    return data ?? [];
  });
