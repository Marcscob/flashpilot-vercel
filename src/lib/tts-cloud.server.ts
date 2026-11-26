// Geração de áudio na nuvem (Gemini direto na API do Google AI Studio).
// Módulo server-only: usado tanto pelo caminho direto (Fase 6) quanto pelo
// cache compartilhado (Fase 7).
import { base64ToBytes, geminiGenerateContentUrl, pcmToWav } from "./gemini-api.server";
import { spokenTextLanguage } from "./speech-language";
import { prepareForSpeech } from "./speech-text";
import { findBlogLang } from "./blog-langs";

export const DEFAULT_VOICE = "Kore";
export { TTS_CACHE_VOICE } from "./speech-cache-version";

// Modelo de voz disponível na API direta do Google AI Studio.
// Stable successor of gemini-2.5-flash-preview-tts (shut down 18/12/2026).
const TTS_MODEL = "gemini-3.8-flash-tts";

/** Instrução de leitura por idioma (Fase 6). Sem idioma = português, como antes. */
const READING_PROMPT: Record<string, string> = {
  pt: "Leia em voz alta, em português, com voz feminina natural:",
  "pt-PT": "Leia em voz alta, em português de Portugal, com voz feminina natural:",
  en: "Read aloud in English with a natural female voice:",
  es: "Lee en voz alta, en español, con voz femenina natural:",
  fr: "Lis à voix haute, en français, avec une voix féminine naturelle :",
  it: "Leggi ad alta voce, in italiano, con voce femminile naturale:",
  de: "Lies laut auf Deutsch mit natürlicher weiblicher Stimme vor:",
  ja: "自然な女性の声で日本語で読み上げてください：",
  uk: "Прочитайте вголос українською природним жіночим голосом:",
  ar: "اقرأ بصوت عالٍ بالعربية بصوت نسائي طبيعي:",
  zh: "请用自然的女声朗读：",
  ru: "Прочитайте вслух по-русски естественным женским голосом:",
};

export function promptFor(lang?: string): string {
  const normalized = (lang ?? "").replace("_", "-").toLowerCase();
  const primary = normalized.split("-")[0] ?? "";
  if (normalized === "pt-pt") return READING_PROMPT["pt-PT"]!;
  if (READING_PROMPT[primary]) return READING_PROMPT[primary]!;
  if (primary && primary !== "pt") {
    const langInfo = findBlogLang(normalized) ?? findBlogLang(primary);
    const langName = langInfo?.name ?? primary;
    return `Read aloud in ${langName} with a natural female voice:`;
  }
  return READING_PROMPT.pt!;
}

export function readingText(text: string, lang?: string): string {
  // gemini-3.8-flash-tts speaks any instruction sent with the text (no system
  // instruction support), so only the content goes out; Kore sets the voice.
  void lang;
  return prepareForSpeech(text);
}

export function bytesToBase64(buf: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Chamada única à API do Gemini. Retorna os bytes brutos (WAV) e o mime. */
export async function synthesizeAudioBytes(
  text: string,
  lang: string | undefined,
  _voice: string | undefined,
  signal?: AbortSignal,
): Promise<{ bytes: Uint8Array; mime: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const res = await fetch(geminiGenerateContentUrl(TTS_MODEL), {
    method: "POST",
    signal,
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: readingText(text, lang) }],
        },
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: DEFAULT_VOICE },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 403)
      throw new Error(
        "O Google bloqueou o acesso à leitura do PilotAI. Verifique a configuração do serviço.",
      );
    if (res.status === 429) throw new Error("Limite de requisições atingido, tente em instantes");
    console.error(`Gemini TTS falhou (${res.status}): ${body.slice(0, 200)}`);
    throw new Error(`O Google não conseguiu gerar a leitura do PilotAI (${res.status}).`);
  }

  // A API nativa devolve PCM (audio/L16, 24 kHz, mono) em base64; empacotamos
  // em WAV para manter o formato que o app já consome.
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
  };
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const data = part?.inlineData?.data;
  if (!data) throw new Error("Falha no TTS: resposta sem áudio.");
  const pcm = base64ToBytes(data);
  // Modelos estáveis podem já devolver WAV pronto.
  if (/wav/i.test(part?.inlineData?.mimeType ?? "")) return { bytes: pcm, mime: "audio/wav" };
  const rateMatch = part?.inlineData?.mimeType?.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24_000;
  return { bytes: pcmToWav(pcm, sampleRate), mime: "audio/wav" };
}

/** Mesmo áudio, já em base64 (formato usado pelo caminho direto). */
export async function synthesizeAudio(
  text: string,
  lang: string | undefined,
  voice: string | undefined,
  signal?: AbortSignal,
): Promise<{ audio: string; mime: string }> {
  const { bytes, mime } = await synthesizeAudioBytes(text, lang, voice, signal);
  return { audio: bytesToBase64(bytes), mime };
}
