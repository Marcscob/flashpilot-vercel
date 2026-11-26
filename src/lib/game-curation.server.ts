import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fetchAiProvider } from "./ai-provider-fetch.server";
import { GEMINI_CHAT_URL, geminiHeaders, geminiModel, requireGeminiKey } from "./gemini-api.server";
import { GameAuditSchema, candidateTaxonomy } from "./game-curation";
import { parseJsonLenient } from "./json-repair";
import type { MatchRound } from "./match-game";

type Admin = SupabaseClient<Database>;

/** Envia um FlashMatch recém-criado para a fila de curadoria (privada, pendente). Nunca lança. */
export async function submitGameForCuration(
  admin: Admin,
  input: {
    deckId: string;
    userId: string;
    topicId: string;
    title: string;
    language: string | null;
    rounds: MatchRound[];
  },
): Promise<void> {
  try {
    const { data: topic } = await admin
      .from("topics")
      .select("name, parent_id, subject_id")
      .eq("id", input.topicId)
      .maybeSingle();
    if (!topic) return;
    const [{ data: subject }, parent] = await Promise.all([
      admin.from("subjects").select("name, language").eq("id", topic.subject_id).maybeSingle(),
      topic.parent_id
        ? admin.from("topics").select("name").eq("id", topic.parent_id).maybeSingle()
        : Promise.resolve({ data: null as { name: string } | null }),
    ]);
    if (!subject) return;
    const taxonomy = candidateTaxonomy({
      subject: subject.name,
      topic: topic.name,
      parent: parent.data?.name,
    });
    const { error } = await admin.from("community_game_curation").upsert(
      {
        source_deck_id: input.deckId,
        submitted_by: input.userId,
        title: input.title,
        ...taxonomy,
        language: input.language || subject.language || "pt",
        rounds:
          input.rounds as unknown as Database["public"]["Tables"]["community_game_curation"]["Insert"]["rounds"],
        audit_reason: "Aguardando auditoria.",
      },
      { onConflict: "source_deck_id", ignoreDuplicates: true },
    );
    if (error) console.error("FlashMatch curation submit failed", error.message);
  } catch (error) {
    console.error("FlashMatch curation submit failed", error);
  }
}

const AUDIT_PROMPT = `You audit a column-matching study game before it is considered for a commercial study library. The game has rounds of concept/explanation pairs.
Mark "eligible": true ONLY when ALL of these hold:
- the content is general educational material or public facts that are broadly correct;
- it contains no personal data (private people's names, e-mails, phones, addresses, document numbers) and nothing confidential;
- it does not reproduce long passages of a copyrighted book, course or exam: short factual statements are fine;
- it is safe and not offensive, and it is actually study content.
"risk" must be one of: "public_fact" (eligible), "rights_uncertain", "personal_data", "incorrect", "not_study".
"reason": one or two sentences in the language of the game explaining the verdict.
Also propose a clean taxonomy in the language of the game: "subject" (general discipline, at most 5 words), "chapter" (broad chapter) and "topic" (specific subject of this game).
Return ONLY JSON: {"eligible":true|false,"risk":"...","reason":"...","subject":"...","chapter":"...","topic":"..."}`;

export async function auditGameCandidate(
  game: {
    title: string;
    language: string;
    subject: string;
    chapter: string;
    topic: string;
    rounds: MatchRound[];
  },
  signal: AbortSignal,
) {
  const key = requireGeminiKey();
  const payload = JSON.stringify({
    title: game.title,
    language: game.language,
    current_taxonomy: { subject: game.subject, chapter: game.chapter, topic: game.topic },
    rounds: game.rounds.map((round) => round.pairs),
  }).slice(0, 30_000);
  const resp = await fetchAiProvider(
    GEMINI_CHAT_URL,
    {
      method: "POST",
      headers: geminiHeaders(key),
      body: JSON.stringify({
        model: geminiModel("google/gemini-3.1-flash-lite"),
        messages: [
          { role: "system", content: AUDIT_PROMPT },
          { role: "user", content: payload },
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0,
      }),
    },
    signal,
  );
  if (!resp.ok) throw new Error(`Falha na auditoria do FlashMatch (${resp.status}).`);
  const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = GameAuditSchema.safeParse(
    parseJsonLenient(json.choices?.[0]?.message?.content ?? ""),
  );
  if (!parsed.success) throw new Error("Resposta de auditoria inválida.");
  const verdict = parsed.data;
  // Elegível só com o risco "public_fact"; qualquer outro risco derruba a elegibilidade.
  return { ...verdict, eligible: verdict.eligible && verdict.risk === "public_fact" };
}
