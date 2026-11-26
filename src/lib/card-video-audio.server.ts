import { normalizeScenes } from "./card-video";
import { canReuseVideoAudio, videoNarration } from "./card-video-audio";

/**
 * Renders and saves the narration of a freshly created video, so the first play
 * is instant. It is part of the video's own entitlement (already charged when the
 * script was generated), which is why it does not reserve standalone TTS quota,
 * a resource the Free plan does not include.
 */
export async function prerenderCardVideoAudio(videoId: string, userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { TTS_CACHE_VOICE, DEFAULT_VOICE, synthesizeAudioBytes } = await import("./tts-cloud.server");
  const { runWithAiGenerationLease } = await import("./ai-quota.server");
  const { prepareForSpeech } = await import("./speech-text");
  const { ttsStoragePath } = await import("./tts-storage-path");

  const { data: video } = await supabaseAdmin
    .from("card_videos")
    .select("id, user_id, scenes, lang, audio_storage_path, audio_voice")
    .eq("id", videoId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!video) return;
  if (canReuseVideoAudio(video.audio_storage_path, video.audio_voice, TTS_CACHE_VOICE)) return;

  const text = prepareForSpeech(videoNarration(normalizeScenes({ scenes: video.scenes })));
  if (!text || text.length > 4000) return;
  const lang = video.lang.replace("_", "-").trim();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${video.user_id}|${lang}|${TTS_CACHE_VOICE}|${text}`),
  );
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");

  await runWithAiGenerationLease({ userId, actionId: crypto.randomUUID() }, async (signal) => {
    const { bytes, mime } = await synthesizeAudioBytes(text, lang, DEFAULT_VOICE, signal);
    const path = `videos/${ttsStoragePath(hash)}`;
    const uploaded = await supabaseAdmin.storage
      .from("tts-cache")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (uploaded.error) throw uploaded.error;
    const { error } = await supabaseAdmin
      .from("card_videos")
      .update({ audio_storage_path: path, audio_voice: TTS_CACHE_VOICE, audio_mime: mime })
      .eq("id", video.id);
    if (error) throw error;
  });
}
