import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { isAppManagerIdentity } from "./app-manager";
import { ttsStoragePath } from "./tts-storage-path";
import {
  AiQuotaError,
  reserveAiQuota,
  runWithAiGenerationLease,
  settleAiQuota,
  throwIfAiGenerationAborted,
} from "./ai-quota.server";
import {
  DEFAULT_TTS_ORIGIN,
  TTS_ORIGINS,
  longerRetention,
  isTtsOrigin,
  type TtsOrigin,
} from "./tts-retention";

const InputSchema = z.object({
  text: z.string().min(1).max(4000),
  actionId: z.string().uuid().optional(),
  lang: z.string().min(2).max(40).optional(),
  voice: z.string().min(1).max(40).optional(),
  origin: z.enum(TTS_ORIGINS).optional(),
});

const BUCKET = "tts-cache";
const SIGNED_URL_TTL = 60 * 60; // 1 hora

async function cacheKey(lang: string, voice: string, text: string, userId?: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId ?? "official"}|${lang}|${voice}|${text}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Áudio oficial usa cache compartilhado; áudio enviado pelo estudante é
 * particionado por usuário. A velocidade é aplicada no player, não na chave.
 */
export const cachedSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { synthesizeAudioBytes, DEFAULT_VOICE, TTS_CACHE_VOICE } = await import("./tts-cloud.server");
    // O catálogo de áudios é compartilhado entre todos os usuários e só pode ser
    // lido/gravado por este servidor: nenhum cliente acessa a tabela nem o bucket.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cache = supabaseAdmin;
    const lang = (data.lang ?? "pt-BR").replace("_", "-").trim();
    const voice = DEFAULT_VOICE;
    // Never reuse segmented Google Cloud audio or the previous Gemini prompt.
    const cacheVoice = TTS_CACHE_VOICE;
    const origin: TtsOrigin = data.origin ?? DEFAULT_TTS_ORIGIN;
    if (origin === "chat") {
      throw new Error("O áudio da conversa não pode usar cache compartilhado.");
    }
    if (origin === "official" && !isAppManagerIdentity(context.claims)) {
      throw new Error("Apenas o AppManager pode publicar áudio oficial.");
    }
    const actionId = data.actionId ?? crypto.randomUUID();

    const generateOrRead = async (signal?: AbortSignal) => {
      const key = await cacheKey(
        lang,
        cacheVoice,
        data.text,
        origin === "student" ? context.userId : undefined,
      );
      const { data: hit, error: hitError } = await cache
        .from("tts_cache")
        .select("id, storage_path, mime, use_count, origin")
        .eq("cache_key", key)
        .eq("origin", origin)
        .maybeSingle();
      if (hitError) throw hitError;

      if (hit?.storage_path) {
        const signed = await cache.storage
          .from(BUCKET)
          .createSignedUrl(hit.storage_path, SIGNED_URL_TTL);
        if (signed.error) throw signed.error;
        if (signed.data?.signedUrl) {
          if (signal) throwIfAiGenerationAborted(signal);
          const current = isTtsOrigin(hit.origin) ? hit.origin : DEFAULT_TTS_ORIGIN;
          const { error: updateError } = await cache.rpc("bump_tts_cache_usage", {
            p_id: hit.id,
            p_origin: longerRetention(current, origin),
          });
          if (updateError) throw updateError;
          return { url: signed.data.signedUrl, mime: hit.mime ?? "audio/wav", cached: true };
        }
      }

      const { bytes, mime } = await synthesizeAudioBytes(data.text, lang, voice, signal);
      if (signal) throwIfAiGenerationAborted(signal);
      const path = ttsStoragePath(key);

      const upload = await cache.storage.from(BUCKET).upload(path, bytes, {
        contentType: mime,
        upsert: true,
      });
      if (upload.error) throw new Error(upload.error.message);

      const { error: cacheError } = await cache.from("tts_cache").upsert(
        {
          cache_key: key,
          lang,
          voice: cacheVoice,
          storage_path: path,
          mime,
          char_count: data.text.length,
          origin,
          created_by: context.userId,
        },
        { onConflict: "cache_key" },
      );
      if (cacheError) throw cacheError;

      const signed = await cache.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
      if (signed.error) throw signed.error;
      if (!signed.data?.signedUrl) throw new Error("Falha ao liberar o áudio gerado");
      if (signal) throwIfAiGenerationAborted(signal);
      const { recordAiUsage } = await import("./ai-credits.server");
      await recordAiUsage(context.userId, "tts_cloud", data.text.length, lang);
      return { url: signed.data.signedUrl, mime, cached: false };
    };

    if (origin === "official") return generateOrRead();

    let reservationForAbort: Awaited<ReturnType<typeof reserveAiQuota>> | null = null;
    return runWithAiGenerationLease({ userId: context.userId, actionId }, async (signal) => {
      const reservation = await reserveAiQuota({
        userId: context.userId,
        actionId,
        jobId: actionId,
        resource: "tts_standalone",
        units: data.text.length,
      });
      if (reservation.wasExisting) {
        throw new AiQuotaError("Esta operação já foi iniciada. Atualize o estado antes de tentar novamente.");
      }
      reservationForAbort = reservation;

      let result: Awaited<ReturnType<typeof generateOrRead>>;
      try {
        throwIfAiGenerationAborted(signal);
        result = await generateOrRead(signal);
        throwIfAiGenerationAborted(signal);
      } catch (operationError) {
        try {
          await settleAiQuota({
            reservationId: reservation.reservationId,
            success: false,
            wasSent: true,
          });
        } catch (settlementError) {
          console.error("Failed to settle TTS quota after operation failure", settlementError);
          throw new AggregateError(
            [operationError, settlementError],
            "A geração do áudio falhou e a cota não pôde ser reconciliada.",
          );
        }
        throw operationError;
      }

      await settleAiQuota({
        reservationId: reservation.reservationId,
        success: !result.cached,
        wasSent: !result.cached,
      });
      return result;
    }, async () => {
      if (!reservationForAbort) return;
      await settleAiQuota({
        reservationId: reservationForAbort.reservationId,
        success: false,
        wasSent: true,
      });
    });
  });
