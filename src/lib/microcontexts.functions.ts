import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeMicroGroups } from "./microcontext-rules";
import { PROGRAMMING_EXAMPLE_RULES } from "./card-guidelines";
import { MICRO_PRACTICAL_EXAMPLE_RULE, STANDARD_LANGUAGE_RULES } from "./card-guidelines";

const MAX_CARDS = 200;

/**
 * Agrupa os cards de um tópico (na ordem da fonte) em microcontextos com
 * texto de ambientação (Card 0). Vale para qualquer fonte, pois roda depois
 * dos cards salvos. Só cards ainda sem microcontexto são agrupados.
 */
export const buildTopicMicrocontexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ topicId: z.string().uuid(), language: z.string().max(20).optional() }).parse(i))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: topic } = await supabase.from("topics").select("id, subject_id, name").eq("id", data.topicId).maybeSingle();
    if (!topic) throw new Error("Tópico não encontrado.");
    const { data: subjectRow } = await supabase.from("subjects").select("name").eq("id", topic.subject_id).maybeSingle();
    const { data: cards, error } = await supabase
      .from("flashcards")
      .select("id, question, answer")
      .eq("topic_id", data.topicId)
      .eq("user_id", userId)
      .is("microcontext_id", null)
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(MAX_CARDS);
    if (error) throw new Error(error.message);
    if (!cards?.length) return { created: 0 };

    const list = cards
      .map((c, i) => `[${i}] P: ${c.question.slice(0, 400)} | R: ${c.answer.slice(0, 400)}`)
      .join("\n");
    const prompt = `Você organiza flashcards de estudo em microcontextos (blocos temáticos contíguos), preservando a ordem.
Regras:
- Agrupe cards consecutivos que tratam do mesmo subtema; 2 a 12 cards por bloco.
- Nunca reordene; cada bloco termina no índice "end" (inclusivo) e o próximo começa no seguinte.
- "title": título curto do subtema. "content": texto didático fluido (80 a 180 palavras) que contextualiza o bloco antes do estudo, fiel aos cards, sem inventar fatos, sem markdown, sem emojis. Escreva o "content" apenas com o conteúdo técnico dos cards: nada de promessas, frases motivacionais, metáforas genéricas, sumários ou autopromoção.
- Ortografia e estilo do "content": norma culta formal do idioma, com acentuação, cedilhas, crases e diacríticos completos (nunca escreva sem acentos, ex.: "variáveis", "números", "porém", "não"); pontuação precisa; períodos encadeados que expliquem causa, efeito e o raciocínio prático que liga os conceitos, em síntese densa e não em lista solta.
- Matéria: "${subjectRow?.name ?? ""}". Assunto: "${topic.name ?? ""}". Use-os para identificar a área.
${MICRO_PRACTICAL_EXAMPLE_RULE}
${STANDARD_LANGUAGE_RULES}
- Escreva no idioma dos cards${data.language ? ` (${data.language})` : ""}.
${PROGRAMMING_EXAMPLE_RULES}
Responda só JSON: {"groups":[{"title":"...","content":"...","end":N}]}

Cards:
${list}`;

    const { fetchLightChat } = await import("./gemini-api.server");
    const resp = await fetchLightChat(
      {
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 8000,
      },
      undefined,
      "microcontexts",
    );
    if (!resp.ok) throw new Error("O PilotAI não conseguiu organizar os blocos agora.");
    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const { parseJsonLenient } = await import("./json-repair");
    const parsed = parseJsonLenient(json.choices?.[0]?.message?.content ?? "{}") as { groups?: unknown };
    const groups = normalizeMicroGroups(parsed?.groups, cards.length);
    if (!groups.length) throw new Error("O PilotAI não conseguiu organizar os blocos agora.");

    const { count } = await supabase
      .from("microcontexts")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", data.topicId);
    const base = count ?? 0;
    const { data: rows, error: insErr } = await supabase
      .from("microcontexts")
      .insert(groups.map((g, i) => ({
        user_id: userId, subject_id: topic.subject_id, topic_id: topic.id,
        order_index: base + i, title: g.title, content: g.content,
      })))
      .select("id, order_index");
    if (insErr || !rows) throw new Error(insErr?.message ?? "Falha ao salvar blocos.");
    rows.sort((a, b) => a.order_index - b.order_index);
    for (let i = 0; i < groups.length; i++) {
      const ids = cards.slice(groups[i].start, groups[i].end + 1).map((c) => c.id);
      await supabase.from("flashcards").update({ microcontext_id: rows[i].id }).in("id", ids);
    }
    return { created: rows.length };
  });
