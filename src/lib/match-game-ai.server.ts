import { parseJsonLenient } from "./json-repair";
import { fetchAiProvider } from "./ai-provider-fetch.server";
import { GEMINI_CHAT_URL, geminiHeaders, geminiModel, requireGeminiKey } from "./gemini-api.server";
import { chunkIntoRounds, normalizePairs, targetPairCount, type MatchRound } from "./match-game";

export const MATCH_MODEL = "google/gemini-3.1-flash-lite";
const MAX_OUTPUT_TOKENS = 6000;
export const MATCH_NO_CONTENT =
  "O PilotAI não encontrou conteúdo suficiente para criar o FlashMatch.";

export type MatchSourceCard = { question: string; answer: string };

const clip = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);

export function buildMatchSystemPrompt(pairCount: number): string {
  return `You turn flashcards into a column-matching game. The input is a JSON list of flashcards (q = question, a = answer) written in one language.
Produce up to ${pairCount} pairs. Each pair has "left" (a CONCEPT: a term, rule, name, date, article or very short question, at most 8 words) and "right" (its explanation or answer, at most 20 words) so that a student can match each concept with its explanation.
Rules:
- Write in the SAME language as the flashcards. Keep proper names, legal references and technical terms exactly as they appear.
- Base every pair strictly on the flashcards; never invent facts.
- Each "right" must fit ONLY its own "left". Avoid vague answers that could match two concepts; if two cards are too similar, keep only one of them.
- Every pair must be about a DIFFERENT fact. Never write two pairs whose explanations describe the same fact or overlap (for example two ways of saying the same thing). If the flashcards hold fewer distinct facts than requested, return fewer pairs (at least 3 when possible).
- Every "right" must be a self-contained statement that makes sense on its own: never a yes/no answer, never starting with "Yes"/"No", never a bare pronoun reference.
- No repeated concepts and no repeated explanations. No markdown, no numbering, no quotes.
- Keep the order of the flashcards so that neighbouring pairs are related.
- Rewrite long answers as one clear short sentence. For multiple-choice or fill-in-the-blank cards use the correct answer.
- "title": a short title of the subject, at most 60 characters, in the same language.
Return ONLY JSON: {"title":"...","pairs":[{"left":"...","right":"..."}]}`;
}

export function buildMatchUserContent(cards: MatchSourceCard[]): string {
  return JSON.stringify(cards.map((c) => ({ q: clip(c.question, 300), a: clip(c.answer, 500) })));
}

/** Interpreta a resposta do modelo; devolve título e rodadas prontas (3 a 5 pares). */
export function parseMatchResponse(content: string): { title: string; rounds: MatchRound[] } {
  const parsed = parseJsonLenient(content) as { title?: unknown; pairs?: unknown } | undefined;
  const rounds = chunkIntoRounds(normalizePairs(parsed?.pairs));
  if (!rounds.length) throw new Error(MATCH_NO_CONTENT);
  const title = typeof parsed?.title === "string" ? clip(parsed.title, 60) : "";
  return { title, rounds };
}

export async function generateMatchGame(
  cards: MatchSourceCard[],
  signal: AbortSignal,
): Promise<{ title: string; rounds: MatchRound[] }> {
  const key = requireGeminiKey();
  const resp = await fetchAiProvider(
    GEMINI_CHAT_URL,
    {
      method: "POST",
      headers: geminiHeaders(key),
      body: JSON.stringify({
        model: geminiModel(MATCH_MODEL),
        messages: [
          { role: "system", content: buildMatchSystemPrompt(targetPairCount(cards.length)) },
          { role: "user", content: buildMatchUserContent(cards) },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
      }),
    },
    signal,
  );
  if (!resp.ok) {
    if (resp.status === 429)
      throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
    throw new Error(`Falha ao criar o FlashMatch (${resp.status}).`);
  }
  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const choice = json.choices?.[0];
  if (choice?.finish_reason === "length")
    throw new Error("A resposta do PilotAI excedeu o limite de saída.");
  return parseMatchResponse(choice?.message?.content ?? "");
}
