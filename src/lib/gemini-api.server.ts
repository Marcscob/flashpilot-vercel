/**
 * Acesso direto à API do Google AI Studio (Gemini) usando GEMINI_API_KEY.
 *
 * Ponto único de configuração: endpoint, chave e conversão de modelos.
 * As rotas que antes chamavam o Lovable AI Gateway (modelos google/*) ou o
 * Groq passam a chamar aqui, preservando prompts, formatos e regras.
 *
 * O endpoint /v1beta/openai/ é compatível com o formato OpenAI de chat
 * (messages, response_format, max_tokens), então os corpos das requisições
 * existentes continuam válidos — só mudam URL, chave e nome do modelo.
 */

export const GEMINI_CHAT_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const GEMINI_NATIVE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Chave do Google AI Studio; ausência significa recurso indisponível. */
export function geminiApiKey(): string | undefined {
  return process.env["GEMINI_API_KEY"];
}

export function requireGeminiKey(): string {
  const key = geminiApiKey();
  if (!key) throw new Error("Configuração do PilotAI indisponível. Tente novamente mais tarde.");
  return key;
}

/** Remove o prefixo "google/" usado no gateway; na API direta o id é sem ele. */
export function geminiModel(model: string): string {
  return model.replace(/^google\//, "");
}

/** URL do endpoint nativo generateContent (TTS, transcrição de áudio). */
export function geminiGenerateContentUrl(model: string): string {
  return `${GEMINI_NATIVE_URL}/${geminiModel(model)}:generateContent`;
}

/** Cabeçalhos autenticados para a API direta do Gemini. */
export function geminiHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "x-goog-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

/**
 * Empacota PCM bruto (audio/L16, 24 kHz, 16 bits, mono — formato devolvido
 * pelo TTS do Gemini) em um contêiner WAV, mantendo o mime "audio/wav" que
 * o restante do app já espera.
 */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24_000): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // tamanho do bloco fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes por segundo
  view.setUint16(32, 2, true); // alinhamento (1 canal × 16 bits)
  view.setUint16(34, 16, true); // bits por amostra
  writeStr(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  const wav = new Uint8Array(44 + pcm.byteLength);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, 44);
  return wav;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const LOVABLE_GATEWAY_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const LIGHT_GEMINI_MODEL = "gemini-3.1-flash-lite";

type LightChatBody = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  reasoning_effort?: string;
  max_tokens?: number;
  response_format?: { type: "json_object" };
  temperature?: number;
};

async function logLightFallback(feature: string, reason: string) {
  const { logAiFallback } = await import("./ai-fallback-log.server");
  await logAiFallback(feature, LIGHT_GEMINI_MODEL, "gateway", reason);
}

/** Há alguma rota configurada (Gemini direto ou gateway) para utilitários leves? */
export function hasLightChatProvider(): boolean {
  return Boolean(geminiApiKey() || process.env["LOVABLE_API_KEY"]);
}

/**
 * Utilitários leves (tradução, normalização de ditado, auditoria, mapa mental):
 * tenta primeiro o Gemini Flash-Lite direto com GEMINI_API_KEY; se a chave não
 * existir ou a chamada falhar, usa o corpo original no gateway (LOVABLE_API_KEY).
 * Devolve a Response no formato OpenAI chat para os chamadores seguirem iguais.
 */
export async function fetchLightChat(
  gatewayBody: LightChatBody,
  signal?: AbortSignal,
  feature = "light-chat",
): Promise<Response> {
  const gKey = geminiApiKey();
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (gKey) {
    try {
      const resp = await fetch(GEMINI_CHAT_URL, {
        method: "POST",
        signal,
        headers: geminiHeaders(gKey),
        body: JSON.stringify({
          model: LIGHT_GEMINI_MODEL,
          messages: gatewayBody.messages,
          ...(gatewayBody.response_format ? { response_format: gatewayBody.response_format } : {}),
          ...(gatewayBody.temperature !== undefined ? { temperature: gatewayBody.temperature } : {}),
          ...(gatewayBody.max_tokens ? { max_tokens: gatewayBody.max_tokens } : {}),
        }),
      });
      if (resp.ok || !lovableKey) return resp;
      console.warn(`[light-chat] Gemini falhou (${resp.status}); usando gateway.`);
      await logLightFallback(feature, `HTTP ${resp.status}`);
    } catch (error) {
      if (signal?.aborted || !lovableKey) throw error;
      console.warn("[light-chat] Gemini indisponível; usando gateway.");
      await logLightFallback(feature, "indisponível");
    }
  } else if (lovableKey) {
    await logLightFallback(feature, "GEMINI_API_KEY ausente");
  }
  if (!lovableKey) throw new Error("Configuração do PilotAI indisponível. Tente novamente mais tarde.");
  return fetch(LOVABLE_GATEWAY_CHAT_URL, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(gatewayBody),
  });
}
