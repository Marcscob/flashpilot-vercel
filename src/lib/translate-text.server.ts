/**
 * Tradução momentânea do texto de um flashcard para o idioma do usuário.
 *
 * Usada apenas como ajuda de leitura durante a revisão: nada é gravado no
 * card. Mesma rota e mesmo modelo já usados pela conversação.
 */
import { LANGUAGE_CHAT_MODEL, languageNameFor, stripMarkup } from "./language-chat.server";

import { fetchLightChat, hasLightChatProvider } from "./gemini-api.server";

export async function translateFlashcardText(
  text: string,
  targetLang: string,
  sourceLang?: string | null,
  signal?: AbortSignal,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (!hasLightChatProvider()) throw new Error("Tradução indisponível agora.");

  const from = sourceLang ? ` from ${languageNameFor(sourceLang)}` : "";
  const system = [
    `You translate flashcard text${from} into ${languageNameFor(targetLang)}.`,
    "Keep the structure exactly: line breaks, blanks made of underscores, and option letters (A), B), C), D)) stay in place.",
    "Translate labels too (e.g. Full answer:, Option B)) into the target language.",
    "Plain text only: never use asterisks, underscores for emphasis, backticks or markdown.",
    "Return only the translated text: no quotes, no notes, no explanations.",
  ].join(" ");

  const resp = await fetchLightChat(
    {
      model: LANGUAGE_CHAT_MODEL,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: system },
        { role: "user", content: trimmed },
      ],
      max_tokens: 4096,
    },
    signal,
    "translate-card",
  );

  if (!resp.ok) {
    if (resp.status === 429)
      throw new Error("Muitas traduções seguidas. Tente novamente em alguns segundos.");
    if (resp.status === 402 || resp.status === 403)
      throw new Error("Créditos do PilotAI esgotados para a tradução.");
    throw new Error("Não consegui traduzir agora. Tente novamente.");
  }

  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const choice = json.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new Error(
      "A tradução atingiu o limite de tamanho. Use um trecho menor e tente novamente.",
    );
  }
  const out = stripMarkup(choice?.message?.content ?? "");
  if (!out) throw new Error("Não consegui traduzir agora. Tente novamente.");
  return out;
}
