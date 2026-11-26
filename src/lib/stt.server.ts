/**
 * Normalização de idioma do ditado.
 *
 * O ditado da conversa deve sempre devolver o texto no idioma escolhido,
 * mesmo quando a pessoa fala em português. A transcrição é feita com
 * detecção automática e, quando o idioma alvo não é o português, o texto
 * passa por esta normalização.
 *
 * Falha aqui nunca quebra o ditado: quem chama usa a transcrição original.
 */
import { LANGUAGE_CHAT_MODEL, languageNameFor } from "./language-chat.server";
import { DEFAULT_LANGUAGE } from "./languages";

import { fetchLightChat, hasLightChatProvider } from "./gemini-api.server";

export function needsLanguageNormalization(lang?: string | null): boolean {
  if (!lang) return false;
  return lang !== DEFAULT_LANGUAGE && !lang.startsWith("pt");
}

export async function normalizeToLanguage(
  text: string,
  lang: string,
  signal?: AbortSignal,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  if (!hasLightChatProvider()) return trimmed;

  const target = languageNameFor(lang);
  const system = [
    `You rewrite a dictated sentence so that it is always in ${target}.`,
    `If the text is already in ${target}, return it unchanged.`,
    `If it is in any other language, translate it naturally into ${target}.`,
    "Return only the resulting sentence: no quotes, no explanations, no notes.",
  ].join(" ");

  try {
    const resp = await fetchLightChat(
      {
        model: LANGUAGE_CHAT_MODEL,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: system },
          { role: "user", content: trimmed },
        ],
      },
      signal,
      "stt-normalize",
    );
    if (!resp.ok) return trimmed;
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const out = json.choices?.[0]?.message?.content?.trim();
    return out || trimmed;
  } catch (error) {
    if (signal?.aborted) throw error;
    return trimmed;
  }
}
