import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { isAppManagerIdentity } from "./app-manager";

const TtsOriginSchema = z.enum(["official", "student", "chat"]).default("student");
const InputSchema = z.object({
  text: z.string().min(1).max(4000),
  actionId: z.string().uuid().optional(),
  origin: TtsOriginSchema.optional(),
});

const MultiInputSchema = z.object({
  text: z.string().min(1).max(4000),
  actionId: z.string().uuid().optional(),
  lang: z.string().min(2).max(40).optional(),
  origin: TtsOriginSchema.optional(),
  voice: z.string().min(1).max(40).optional(),
});

function wavDurationSeconds(dataUrlAudio: string): number | null {
  const base64 = dataUrlAudio.replace(/^data:[^,]*;base64,/, "");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  if (bytes.length < 44 || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF") return null;

  let byteRate = 0;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunk = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (chunk === "fmt " && size >= 16 && offset + 28 <= bytes.length) {
      byteRate = view.getUint32(offset + 16, true);
    }
    if (chunk === "data") {
      if (!byteRate) return null;
      return size / byteRate;
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

async function synthesizeAuthorized(
  text: string,
  lang: string | undefined,
  voice: string | undefined,
  origin: "official" | "student" | "chat",
  actionId: string | undefined,
  context: {
    supabase: SupabaseClient<Database>;
    userId: string;
    claims: unknown;
  },
) {
  const {
    claimAiChatTtsAttempt,
    consumeAiChatTts,
    isProAiUser,
    runWithAiGenerationLease,
    runWithAiQuota,
    throwIfAiGenerationAborted,
  } = await import("./ai-quota.server");
  const { synthesizeAudio } = await import("./tts-cloud.server");
  if (origin === "official" && !isAppManagerIdentity(context.claims)) {
    throw new Error("Apenas o AppManager pode gerar áudio oficial.");
  }
  if (origin === "chat") {
    if (!actionId) throw new Error("A autorização do turno do tutor expirou.");
    const { chatAudioPath, signChatAudio, saveChatAudio } = await import("./chat-audio.server");
    const path = await chatAudioPath(context.userId, lang, text);
    return runWithAiGenerationLease({ userId: context.userId, actionId }, async (signal) => {
      // Replay precedes entitlement consumption: never synthesize the same saved response twice.
      const saved = await signChatAudio(path);
      if (saved) return { audio: "", mime: "audio/wav", url: saved };
      const isPro = await isProAiUser(context.supabase, context.userId, context.claims);
      // Reivindica a tentativa ANTES de chamar o provider: limita o número
      // de sínteses pagas que uma repetição sequencial da mesma requisição
      // pode gerar, mesmo que consumeAiChatTts só finalize após o sucesso.
      await claimAiChatTtsAttempt({ userId: context.userId, actionId, text });
      const result = await synthesizeAudio(text, lang, voice, signal);
      const duration = wavDurationSeconds(result.audio);
      const maximumSeconds = isPro ? 90 : 45;
      if (duration === null || duration > maximumSeconds) {
        throw new Error("A duração do áudio excede o limite deste turno.");
      }
      throwIfAiGenerationAborted(signal);
      await consumeAiChatTts({
        userId: context.userId,
        actionId,
        text,
      });
      await saveChatAudio(path, result.audio, result.mime);
      return result;
    });
  }

  const quotaActionId = actionId ?? crypto.randomUUID();
  const result = await runWithAiQuota(
    {
      userId: context.userId,
      actionId: quotaActionId,
      jobId: quotaActionId,
      resource: "tts_standalone",
      units: text.length,
    },
    async (_, signal) => {
      const result = await synthesizeAudio(text, lang, voice, signal);
      const duration = wavDurationSeconds(result.audio);
      if (duration === null || duration > 90) {
        throw new Error("A duração do áudio excede o limite técnico.");
      }
      throwIfAiGenerationAborted(signal);
      const { recordAiUsage } = await import("./ai-credits.server");
      await recordAiUsage(context.userId, "tts_cloud", text.length, lang);
      return result;
    },
  );
  return result;
}

/**
 * Fase 6 — áudio em nuvem no idioma do card. Sem `lang`, comportamento
 * idêntico ao PT-BR original (mesmo modelo, mesma voz, mesma instrução).
 */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MultiInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    return synthesizeAuthorized(
      data.text,
      data.lang,
      data.voice,
      data.origin ?? "student",
      data.actionId,
      context,
    );
  });

// Compatibilidade: caminho PT-BR já usado no app.
export const synthesizePtBr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { DEFAULT_VOICE } = await import("./tts-cloud.server");
    return synthesizeAuthorized(
      data.text,
      "pt-BR",
      DEFAULT_VOICE,
      data.origin ?? "student",
      data.actionId,
      context,
    );
  });

export const speechProvider = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(() => ({ googleCloud: Boolean(process.env['GEMINI_API_KEY']) }));

/** Saved messages are authorized with the user's own client; cache misses retain standalone billing. */
export const savedChatSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ messageId: z.string().uuid(), cacheOnly: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: message } = await context.supabase.from("language_chat_messages")
      .select("content, role, session_id").eq("id", data.messageId).maybeSingle();
    if (!message || message.role !== "assistant") throw new Error("Resposta não encontrada.");
    const { data: session } = await context.supabase.from("language_chat_sessions")
      .select("lang").eq("id", message.session_id).maybeSingle();
    if (!session) throw new Error("Conversa não encontrada.");
    const { prepareForSpeech } = await import("./speech-text");
    const { chatAudioPath, signChatAudio, saveChatAudio } = await import("./chat-audio.server");
    // Original tutor excerpts differ by plan; reuse either without a second paid request.
    const candidates = [message.content, message.content.slice(0, 1350), message.content.slice(0, 675)]
      .map(prepareForSpeech);
    for (const text of new Set(candidates)) {
      const url = await signChatAudio(await chatAudioPath(context.userId, session.lang, text));
      if (url) return { url };
    }
    if (data.cacheOnly) return { url: null };
    const text = prepareForSpeech(message.content).slice(0, 4000);
    const path = await chatAudioPath(context.userId, session.lang, text);
    const result = await synthesizeAuthorized(text, session.lang, undefined, "student", undefined, context);
    await saveChatAudio(path, result.audio, result.mime);
    return { url: `data:${result.mime};base64,${result.audio}` };
  });
