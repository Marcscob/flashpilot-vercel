import { parseJsonLenient } from "./json-repair";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { geminiGenerateContentUrl } from "./gemini-api.server";

const TranscribeInput = z.object({
  // base64-encoded audio (data URL prefix will be stripped). Teto calibrado
  // para acompanhar o limite de 3 min do cliente (MicButton/VoiceInput) mesmo
  // em bitrates altos (~256kbps): ~6.3MB decodificados, ~8.4M chars base64.
  audio_base64: z.string().min(1).max(8_400_000),
  mime_type: z.string().default("audio/webm"),
  // Idioma alvo do ditado (Módulo de Idiomas). Ausente ou pt-BR = comportamento
  // atual (transcrição forçada em português).
  lang: z.string().min(2).max(10).optional(),
});

class ProviderAuthError extends Error {}

/** Só consideramos fala de verdade quando há letras ou números no texto. */
function hasSpeech(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

// Transcrição principal: Gemini direto na API do Google AI Studio, recebendo
// o áudio como inline_data no endpoint nativo generateContent.
async function callGeminiTranscribe(apiKey: string, file: File, language: string | undefined, signal: AbortSignal): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);

  // Sem idioma alvo estrangeiro, mantém o português como antes.
  const prompt = language === "pt" || !language
    ? "Listen to the audio. Decide whether it contains intelligible HUMAN SPEECH. Silence, background noise, hiss, music or clicks are NOT speech.\nThe speech is in Brazilian Portuguese; transcribe it exactly, in Brazilian Portuguese.\nReturn ONLY JSON: {\"has_speech\": true|false, \"transcript\": \"exact words spoken; empty string when has_speech is false\"}.\nNever invent or guess words. No comments, no quotes around the transcript, no formatting."
    : "Listen to the audio. Decide whether it contains intelligible HUMAN SPEECH. Silence, background noise, hiss, music or clicks are NOT speech.\nTranscribe exactly what is said, in the language it was spoken.\nReturn ONLY JSON: {\"has_speech\": true|false, \"transcript\": \"exact words spoken; empty string when has_speech is false\"}.\nNever invent or guess words. No comments, no quotes around the transcript, no formatting.";

  const resp = await fetch(geminiGenerateContentUrl("gemini-3.1-flash-lite"), {
    method: "POST",
    signal,
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: file.type || "audio/webm", data: b64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", temperature: 0 },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 401 || resp.status === 403) {
      throw new ProviderAuthError(`Gemini rejeitou a chave (${resp.status}).`);
    }
    if (resp.status === 429) throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
    throw new Error(`Falha na transcrição Gemini (${resp.status}): ${text.slice(0, 200)}`);
  }

  const json = (await resp.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  const parsed = parseJsonLenient(raw) as { has_speech?: boolean; transcript?: unknown } | undefined;
  if (parsed && typeof parsed === "object" && "has_speech" in parsed) {
    return parsed.has_speech ? String(parsed.transcript ?? "").trim() : "";
  }
  return raw;
}

async function callLovableWhisper(apiKey: string, file: File, signal: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("file", file);

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 402) throw new Error("Créditos de PilotAI esgotados. Adicione créditos para continuar usando o ditado por voz.");
    if (resp.status === 429) throw new Error("Muitas requisições. Tente novamente em alguns segundos.");
    throw new Error(`Falha na transcrição (${resp.status}): ${text.slice(0, 200)}`);
  }

  const json = (await resp.json()) as { text?: string };
  return (json.text ?? "").trim();
}

// Transcreve áudio via Gemini direto (Google AI Studio) com fallback
// automático para o Lovable AI Gateway (openai/gpt-4o-mini-transcribe).
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TranscribeInput.parse(data))
  .handler(async ({ data, context }) => {
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    // Remove data URL prefix se existir (mime pode conter ';codecs=...')
    const b64 = data.audio_base64.replace(/^data:[^,]+,/, "");
    if (b64.length > 8_400_000 || b64.length % 4 === 1) {
      throw new Error("O áudio excede o limite permitido.");
    }
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    // Proxy de duração: em bitrates plausíveis (>=256kbps) isso cobre até ~3
    // minutos (o teto de gravação do cliente); mesmo em bitrates muito baixos
    // isso limita o custo por chamada, combinado ao teto mensal de chamadas.
    if (bytes.byteLength > 6.3 * 1024 * 1024) {
      throw new Error("O áudio excede o limite de ~3 minutos de gravação.");
    }

    const mime = data.mime_type.split(";")[0];
    if (!["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"].includes(mime)) {
      throw new Error("Formato de áudio não suportado.");
    }
    const extMap: Record<string, string> = {
      "audio/webm": "webm",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/ogg": "ogg",
    };
    const ext = extMap[mime] ?? "webm";
    const file = new File([bytes], `recording.${ext}`, { type: mime });

    const { assertSttAllowed, recordAiUsage } = await import("./ai-credits.server");
    await assertSttAllowed(context.supabase, context.userId, context.claims);
    const { runWithAiGenerationLease } = await import("./ai-quota.server");
    const result = await runWithAiGenerationLease(
      { userId: context.userId, actionId: crypto.randomUUID() },
      async (signal) => {
        const { needsLanguageNormalization, normalizeToLanguage } = await import("./stt.server");
        const foreign = needsLanguageNormalization(data.lang);
        const whisperLang = foreign ? undefined : "pt";

        let text: string;
        let usedFallback = false;
        try {
          if (!geminiKey) throw new ProviderAuthError("GEMINI_API_KEY não configurada");
          text = await callGeminiTranscribe(geminiKey, file, whisperLang, signal);
        } catch (err) {
          if (!(err instanceof ProviderAuthError)) throw err;
          if (!lovableKey) throw new Error("GEMINI_API_KEY inválida e LOVABLE_API_KEY não configurada.");
          text = await callLovableWhisper(lovableKey, file, signal);
          usedFallback = true;
          const { logAiFallback } = await import("./ai-fallback-log.server");
          await logAiFallback("stt", "gemini-3.1-flash-lite", "openai/gpt-4o-mini-transcribe", err.message);
                  }

                  if (!hasSpeech(text)) return { text: "", usedFallback };

                  if (foreign) {
          text = await normalizeToLanguage(text, data.lang!, signal);
        }
        if (!hasSpeech(text)) return { text: "", usedFallback };
        return { text, usedFallback };
      },
    );
    // Só conta contra a cota mensal depois que a chamada externa foi concluída
    // com sucesso (evita descontar chamadas que falharam por erro do provedor).
    await recordAiUsage(context.userId, "stt", 1, data.lang);
    return result;
  });
