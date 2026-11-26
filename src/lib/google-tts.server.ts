import { googleSpeechPlan, type CloudVoice } from "./google-tts-plan";

let catalog: { voices: CloudVoice[]; expires: number } | undefined;
async function googleError(response: Response): Promise<never> {
  const json = await response.json().catch(() => ({})) as { error?: { message?: string } };
  // Never expose provider URLs or supplied credentials in error messages.
  const safe = (json.error?.message ?? "Falha ao gerar áudio no Google TTS.").replace(/AIza[\w-]+/g, "[redacted]").replace(/https?:\/\/\S+/g, "[Google TTS]");
  throw new Error(`Google TTS (${response.status}): ${safe}`);
}
export async function googleVoiceCatalog(key: string, signal?: AbortSignal): Promise<CloudVoice[]> {
  if (catalog && catalog.expires > Date.now()) return catalog.voices;
  const response = await fetch("https://texttospeech.googleapis.com/v1/voices", { headers: { "x-goog-api-key": key }, signal });
  if (!response.ok) return googleError(response);
  const json = await response.json() as { voices?: CloudVoice[] };
  if (!json.voices?.length) throw new Error("Google TTS: catálogo de vozes vazio.");
  catalog = { voices: json.voices, expires: Date.now() + 3_600_000 };
  return json.voices;
}
const SAMPLE_RATE = 24000;
function pcmOf(wav: Uint8Array): Uint8Array {
  // Google LINEAR16 returns a RIFF/WAV; locate the "data" chunk and keep raw PCM only.
  for (let i = 12; i + 8 <= wav.length;) {
    const id = String.fromCharCode(...wav.subarray(i, i + 4));
    const size = new DataView(wav.buffer, wav.byteOffset + i + 4, 4).getUint32(0, true);
    if (id === "data") return wav.subarray(i + 8, Math.min(wav.length, i + 8 + size));
    i += 8 + size + (size % 2);
  }
  return wav.subarray(44);
}
function wavFromPcm(pcm: Uint8Array): Uint8Array {
  const out = new Uint8Array(44 + pcm.length), v = new DataView(out.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SAMPLE_RATE, true); v.setUint32(28, SAMPLE_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, pcm.length, true); out.set(pcm, 44);
  return out;
}
export async function synthesizeGoogleAudio(text: string, lang: string | undefined, key: string, signal?: AbortSignal) {
  const plan = googleSpeechPlan(text, lang, await googleVoiceCatalog(key, signal));
  for (const s of plan.segments) if (new TextEncoder().encode(JSON.stringify(s.input)).length > 5000) throw new Error("O texto com marcações excede o limite do Google TTS. Divida em trechos menores.");
  const parts = await Promise.all(plan.segments.map(async s => {
    const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ input: s.input, voice: { languageCode: s.languageCode, name: s.voice }, audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: SAMPLE_RATE } }),
    });
    if (!response.ok) return googleError(response);
    const json = await response.json() as { audioContent?: string };
    if (!json.audioContent) throw new Error("Google TTS: resposta sem áudio.");
    return pcmOf(Uint8Array.from(atob(json.audioContent), c => c.charCodeAt(0)));
  }));
  const gap = new Uint8Array(Math.round(SAMPLE_RATE * 0.12) * 2); // short natural pause between voices
  const chunks = parts.flatMap((p, i) => (i ? [gap, p] : [p]));
  const pcm = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0; for (const c of chunks) { pcm.set(c, o); o += c.length; }
  return { bytes: wavFromPcm(pcm), mime: "audio/wav" };
}