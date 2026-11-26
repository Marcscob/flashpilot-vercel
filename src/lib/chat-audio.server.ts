// Private, permanent tutor narration library: one WAV per account/language/voice/text.
import { ttsStoragePath } from "./tts-storage-path";
import { TTS_CACHE_VOICE } from "./speech-cache-version";

const BUCKET = "tts-cache";

export async function chatAudioPath(userId: string, lang: string | undefined, text: string): Promise<string> {
  const normalized = (lang || "pt-BR").replace("_", "-").trim();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`chat|${userId}|${normalized}|${TTS_CACHE_VOICE}|${text}`));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return `chat/${ttsStoragePath(hash)}`;
}

export async function signChatAudio(path: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Best effort: a failed save must never discard audio the user already paid for. */
export async function saveChatAudio(path: string, dataUrl: string, mime: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { base64ToBytes } = await import("./gemini-api.server");
    const bytes = base64ToBytes(dataUrl.replace(/^data:[^,]*;base64,/, ""));
    await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: mime || "audio/wav", upsert: true });
  } catch (error) {
    console.error("Falha ao guardar áudio da conversa", error);
  }
}