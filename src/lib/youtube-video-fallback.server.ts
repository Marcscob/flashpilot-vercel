import { geminiApiKey, geminiGenerateContentUrl } from "./gemini-api.server";
import { canonicalYoutubeUrl } from "./youtube-url";

const MODEL = "gemini-3-flash-preview";
export const VIDEO_FALLBACK_MAX_SECONDS = 60 * 60;
const NO_CONTENT = "NO_STUDY_CONTENT";

const PROMPT = `FaÃ§a a transcriÃ§Ã£o QUASE LITERAL do vÃ­deo, na ordem em que foi falado e no idioma original, como o texto de uma legenda completa (vÃ¡rias centenas de palavras por minuto de explicaÃ§Ã£o). Inclua tambÃ©m o que aparece escrito na tela (fÃ³rmulas, tÃ³picos, definiÃ§Ãµes) quando fizer parte da explicaÃ§Ã£o.
NÃƒO resuma, NÃƒO condense e NÃƒO reescreva: mantenha cada explicaÃ§Ã£o, exemplo, passo de resoluÃ§Ã£o, nÃºmero e dado ditos pelo professor.
Omita SOMENTE o que nÃ£o Ã© conteÃºdo de estudo: saudaÃ§Ãµes, apresentaÃ§Ãµes pessoais, propaganda, patrocÃ­nios, pedidos de inscriÃ§Ã£o/curtida, conversa sem relaÃ§Ã£o com o assunto, mÃºsica e vinhetas.
Sem tÃ­tulos, sem marcadores, sem marcaÃ§Ãµes de tempo e sem comentÃ¡rios seus.
Se o vÃ­deo nÃ£o tiver conteÃºdo de estudo (clipe musical, entretenimento, vlog sem conteÃºdo educativo), responda exatamente ${NO_CONTENT}.`;

type GenerateResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
};

/** LÃª o vÃ­deo pÃºblico pelo link quando o YouTube nÃ£o oferece legendas; devolve sÃ³ texto de estudo. */
export async function transcribeYoutubeWithGemini(value: string, durationSeconds: number | null) {
  const url = canonicalYoutubeUrl(value);
  if (!url) throw new Error("YOUTUBE_INVALID_URL");
  const key = geminiApiKey();
  if (!key) throw new Error("YOUTUBE_NO_CAPTIONS");
  if (durationSeconds !== null && durationSeconds > VIDEO_FALLBACK_MAX_SECONDS) {
    throw new Error("YOUTUBE_NO_CAPTIONS_TOO_LONG");
  }
  const response = await fetch(geminiGenerateContentUrl(MODEL), {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ file_data: { file_uri: url } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 40_000 },
    }),
  });
  if (!response.ok) {
    console.error("YouTube video fallback failed", response.status);
    throw new Error("YOUTUBE_NO_CAPTIONS");
  }
  const json = (await response.json()) as GenerateResponse;
  const text = (json.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text || text.startsWith(NO_CONTENT)) throw new Error("YOUTUBE_NO_STUDY_CONTENT");
  return text;
}
