import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normalizeScenes } from "./card-video";
import { canReuseVideoAudio, videoNarration } from "./card-video-audio";

export const cardVideoAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ videoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: video, error } = await context.supabase
      .from("card_videos")
      .select("id, card_id, microcontext_id, user_id, scenes, lang, audio_storage_path, audio_voice, audio_mime")
      .eq("id", data.videoId)
      .maybeSingle();
    if (error || !video) throw new Error("Vídeo não encontrado.");
    // Autorização pela RLS do próprio chamador: vídeos de card exigem acesso ao card;
    // vídeos de bloco (Card 0) exigem acesso ao microcontexto.
    if (video.card_id) {
      const { data: card } = await context.supabase
        .from("flashcards")
        .select("id")
        .eq("id", video.card_id)
        .maybeSingle();
      if (!card) throw new Error("Card não encontrado.");
    } else {
      const { data: micro } = await context.supabase
        .from("microcontexts")
        .select("id")
        .eq("id", video.microcontext_id ?? "")
        .maybeSingle();
      if (!micro) throw new Error("Bloco não encontrado.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { TTS_CACHE_VOICE, DEFAULT_VOICE, synthesizeAudioBytes } =
      await import("./tts-cloud.server");
    const { runWithAiGenerationLease } = await import("./ai-quota.server");
    const { prepareForSpeech } = await import("./speech-text");
    const { ttsStoragePath } = await import("./tts-storage-path");
    const text = prepareForSpeech(videoNarration(normalizeScenes({ scenes: video.scenes })));
    if (!text || text.length > 4000) throw new Error("Narração inválida.");
    const lang = video.lang.replace("_", "-").trim();
    const sign = async (path: string, mime: string) => {
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("tts-cache")
        .createSignedUrl(path, 3600);
      if (signError || !signed?.signedUrl) throw new Error("Falha ao liberar o áudio salvo.");
      return { url: signed.signedUrl, mime };
    };
    if (
      canReuseVideoAudio(video.audio_storage_path, video.audio_voice, TTS_CACHE_VOICE) &&
      video.audio_storage_path
    ) {
      return sign(video.audio_storage_path, video.audio_mime || "audio/wav");
    }
    // Adopt previously synthesized narration without another provider call.
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${video.user_id}|${lang}|${TTS_CACHE_VOICE}|${text}`),
    );
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    const persist = async (bytes: Uint8Array, mime: string) => {
      const path = `videos/${ttsStoragePath(hash)}`;
      const uploaded = await supabaseAdmin.storage
        .from("tts-cache")
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (uploaded.error) throw uploaded.error;
      const { error: saveError } = await supabaseAdmin
        .from("card_videos")
        .update({ audio_storage_path: path, audio_voice: TTS_CACHE_VOICE, audio_mime: mime })
        .eq("id", video.id);
      if (saveError) throw saveError;
      return sign(path, mime);
    };
    const { data: legacy } = await supabaseAdmin
      .from("tts_cache")
      .select("storage_path, mime")
      .eq("cache_key", hash)
      .eq("origin", "student")
      .maybeSingle();
    if (legacy?.storage_path) {
      const downloaded = await supabaseAdmin.storage
        .from("tts-cache")
        .download(legacy.storage_path);
      if (downloaded.data)
        return persist(
          new Uint8Array(await downloaded.data.arrayBuffer()),
          legacy.mime || "audio/wav",
        );
    }
    const actionId = crypto.randomUUID();
    // A narração faz parte do direito do próprio vídeo (já cobrado ao criá-lo): não reserva a cota de voz avulsa,
    // que o plano de teste não inclui e que fazia a narração cair na voz do navegador sem nunca ser salva.
    return runWithAiGenerationLease({ userId: context.userId, actionId }, async (signal) => {
      // Another queued play may have saved it while this request waited for the account lease.
      const { data: saved } = await supabaseAdmin
        .from("card_videos")
        .select("audio_storage_path, audio_voice, audio_mime")
        .eq("id", video.id)
        .single();
      if (
        saved?.audio_storage_path &&
        canReuseVideoAudio(saved.audio_storage_path, saved.audio_voice, TTS_CACHE_VOICE)
      )
        return sign(saved.audio_storage_path, saved.audio_mime || "audio/wav");
      const { bytes, mime } = await synthesizeAudioBytes(text, lang, DEFAULT_VOICE, signal);
      return persist(bytes, mime);
    });
  });
