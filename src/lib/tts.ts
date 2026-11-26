// Lightweight Web Speech API wrapper (free, browser-native TTS)
import { synthesizePtBr, synthesizeSpeech, speechProvider, savedChatSpeech } from "./tts-cloud.functions";
import { createSpeechMemory } from "./speech-memory";
import { cachedSpeech } from "./tts-cache.functions";
import { cardVideoAudio } from "./card-video-audio.functions";
import { splitTextForSpeech } from "./speech-chunks";
import type { TtsOrigin } from "./tts-retention";
import { createSpeechDispatch } from "./speech-dispatch";
import { prepareForSpeech } from "./speech-text";
import { supabase } from "@/integrations/supabase/client";
import { localSpeechKey, readLocalSpeech, writeLocalSpeech } from "./speech-local-cache";
export { prepareForSpeech } from "./speech-text";

const AUTO_KEY = "fp:tts:auto";
const RATE_KEY = "fp:tts:rate";

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function getAutoPlay(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTO_KEY) === "1";
}

export function setAutoPlay(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTO_KEY, v ? "1" : "0");
}

export function getRate(): number {
  if (typeof window === "undefined") return 1;
  const v = Number(localStorage.getItem(RATE_KEY));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export function setRate(v: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RATE_KEY, String(v));
}

type SpeakFailReason = "unsupported" | "empty" | "cloud-error" | "no-voice";

export type SpeakResult =
  | { ok: true; source: "browser"; voiceName: string; voiceLang: string }
  | { ok: true; source: "cloud"; audio: HTMLAudioElement }
  | { ok: false; reason: SpeakFailReason; message?: string; lang?: string };

export type SpeakOptions = {
  /** Idioma efetivo (Fase 2). Ausente = comportamento atual do app (pt-BR). */
  lang?: string | null;
  /** Velocidade da reprodução; ausente = preferência salva do usuário. */
  rate?: number;
  /** Origem do áudio no catálogo (Fase 8); ausente = material do aluno. */
  origin?: TtsOrigin;
  /** Consumed tutor turn authorizing its matching spoken response. */
  actionId?: string;
  /** Persisted video narration, authorized through its card. */
  videoId?: string;
  /** Account-private repeat practice cache, shared by automatic/manual/prefetched playback. */
  repeatText?: string;
  chatMessageId?: string;
};

let cachedVoice: SpeechSynthesisVoice | null | undefined;

const FRENCH_VOICE_RE = /(^fr\b|\bfr[-_]|français|francais|french|frança|france)/i;
const PORTUGUESE_LANG_RE = /^pt(-|$)/i;
const PORTUGUESE_NAME_RE = /portugu[eê]s|portuguese|brasil|brazil|brazilian|brasileir/i;
const BRAZILIAN_NAME_RE = /maria|fernando|luciana|helo[ií]sa|helena|carlos|paulo|jo[aã]o/i;

function normalizeLang(lang: string): string {
  return lang.replace("_", "-").trim();
}

function browserPrefersPortuguese(): boolean {
  if (typeof navigator === "undefined") return false;
  const languages = [navigator.language, ...(navigator.languages ?? [])]
    .filter(Boolean)
    .map(normalizeLang);
  return languages.some((lang) => PORTUGUESE_LANG_RE.test(lang));
}

function isAndroidBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

function listVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  try {
    return window.speechSynthesis.getVoices();
  } catch {
    return [];
  }
}

function voiceScore(voice: SpeechSynthesisVoice): number {
  const lang = normalizeLang(voice.lang);
  const label = `${voice.name} ${lang}`;

  // Never fall back to French or another non-Portuguese default voice. On Android,
  // Chrome may otherwise use the device's current TTS engine despite u.lang = pt-BR.
  if (FRENCH_VOICE_RE.test(label) && !PORTUGUESE_LANG_RE.test(lang)) return -1;

  if (/^pt-BR$/i.test(lang)) return 100;
  if (/^pt-BR\b/i.test(lang)) return 98;
  if (PORTUGUESE_NAME_RE.test(voice.name) && /brasil|brazil|brazilian|brasileir/i.test(voice.name)) return 95;
  if (PORTUGUESE_LANG_RE.test(lang)) return 85;
  if (PORTUGUESE_NAME_RE.test(voice.name)) return 75;
  if ((!lang || /^pt/i.test(lang)) && BRAZILIAN_NAME_RE.test(voice.name)) return 50;
  return -1;
}

function choosePortugueseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const ranked = voices
    .map((voice) => ({ voice, score: voiceScore(voice) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.voice ?? null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  if (cachedVoice !== undefined) return cachedVoice;
  const voices = listVoices();
  if (!voices.length) return null;
  cachedVoice = choosePortugueseVoice(voices);
  return cachedVoice;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!ttsSupported()) return resolve([]);
    const voices = listVoices();
    if (voices.length) return resolve(voices);

    const handler = () => {
      const loaded = listVoices();
      if (loaded.length) {
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve(loaded);
      }
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);

    // Some browsers fire the event before we attach; also poll as a safety net
    const maxAttempts = 20;
    let attempts = 0;
    const iv = window.setInterval(() => {
      attempts++;
      const loaded = listVoices();
      if (loaded.length || attempts >= maxAttempts) {
        window.clearInterval(iv);
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
        resolve(loaded);
      }
    }, 150);
  });
}

if (typeof window !== "undefined" && ttsSupported()) {
  // Voices load async in some browsers; refresh cache when they become available.
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    cachedVoice = undefined;
    pickVoice();
  });

  // Warm up Android/Chrome voice discovery early so the first tap already has the list.
  loadVoices().then((voices) => {
    cachedVoice = choosePortugueseVoice(voices);
  });
}

let currentCloudAudio: HTMLAudioElement | null = null;
let providerChoice: Promise<{ googleCloud: boolean }> | undefined;
const dispatchSpeech = createSpeechDispatch<{ src: string } | undefined>();
const localAudio = createSpeechMemory();
let localOwner = "";

function rememberAudio(key: string, blob: Blob): { src: string } {
  return { src: localAudio.put(key, blob, currentCloudAudio?.src) };
}

async function queuedCloudAudio(text: string, lang: string | undefined, origin: TtsOrigin | undefined, actionId: string | undefined, current: () => boolean, priority: number, videoId?: string, repeatText?: string, chatMessageId?: string, cacheOnly = false) {
  const { data } = await supabase.auth.getSession();
  const owner = data.session?.user.id;
  if (!owner || !current()) return undefined;
  if (localOwner !== owner) {
    localAudio.clear();
    localOwner = owner;
  }
  const key = await localSpeechKey(owner, repeatText ? prepareForSpeech(repeatText.trim()) : text, lang || "pt-BR", repeatText ? "repeat-private" : videoId ? `video:${videoId}` : origin || "student");
  const persistent = true;
  const valid = () => current() && localOwner === owner;
  const read = async () => {
    if (!persistent) return undefined;
    const memory = localAudio.get(key);
    if (memory) return { src: memory };
    const blob = await readLocalSpeech(key);
    return blob && valid() ? rememberAudio(key, blob) : undefined;
  };
  const hit = await read();
  if (hit) return hit;
  return dispatchSpeech(!persistent ? `${key}:${actionId}` : key, valid, async () => {
    const work = async () => {
      const cached = await read(); // A preceding request/tab may have populated IndexedDB.
      if (cached) return cached;
      const responseAudio = chatMessageId ? { src: (await savedChatSpeech({ data: { messageId: chatMessageId, cacheOnly } })).url }
        : videoId ? { src: (await cardVideoAudio({ data: { videoId } })).url } : await cloudAudioFor(text, lang, origin, actionId, Boolean(repeatText));
      if (!responseAudio.src) return undefined;
      const result = { src: responseAudio.src };
      if (!persistent) return result;
      try {
        const response = await fetch(result.src);
        if (!response.ok) return result;
        const blob = await response.blob();
        if (!blob.size || !blob.type.startsWith("audio/")) return result;
        await writeLocalSpeech(key, blob);
        return valid() ? rememberAudio(key, blob) : result;
      } catch { return result; }
    };
    // Coordinate synthesis across tabs of this origin as well as this reader.
    return navigator.locks ? navigator.locks.request(`flashpilot-tts:${owner}`, work) : work();
  }, priority);
}

/** No playback, no retries. Dropped windows never start new paid work. */
export async function prefetchSpeech(text: string, lang: string | undefined, current: () => boolean, options?: Pick<SpeakOptions, "origin" | "actionId" | "repeatText" | "chatMessageId">): Promise<void> {
  const clean = prepareForSpeech(text.trim());
  if (!clean || clean.length > 4000 || !current() || !navigator.onLine) return;
  providerChoice ??= speechProvider();
  if (!(await providerChoice).googleCloud || !current()) return;
  await queuedCloudAudio(clean, lang ? normalizeLang(lang) : undefined, options?.origin, options?.actionId, current, 0, undefined, options?.repeatText, options?.chatMessageId, Boolean(options?.chatMessageId));
}

// Fase 6 — reaproveitamento do áudio já gerado nesta sessão (mesmo texto+idioma).
// Fase 7 — antes disso, o cache compartilhado no banco atende qualquer usuário.
async function cloudAudioFor(
  text: string,
  lang?: string,
  origin?: TtsOrigin,
  actionId?: string,
  privateRepeat = false,
): Promise<{ src: string }> {
  if (origin !== "chat" && !privateRepeat) {
    const shared = await cachedSpeech({
      data: {
        text,
        actionId: actionId ?? crypto.randomUUID(),
        ...(lang ? { lang } : {}),
        ...(origin ? { origin } : {}),
      },
    });
    if (shared?.url) {
      return { src: shared.url };
    }
  }

  // Tutor responses are private and bypass the shared TTS cache.
  const result = lang
    ? await synthesizeSpeech({ data: { text, lang, actionId, origin } })
    : await synthesizePtBr({ data: { text, actionId, origin } });
  if ("url" in result && typeof result.url === "string") return { src: result.url };
  return { src: `data:${result.mime};base64,${result.audio}` };
}

type CloudChunk = { el: HTMLAudioElement; finished: Promise<void> };

// Um único elemento de áudio reaproveitado: navegadores só liberam a reprodução
// automática em elementos que já tocaram durante um toque do usuário.
let cloudEl: HTMLAudioElement | null = null;

function cloudElement(): HTMLAudioElement {
  if (!cloudEl) cloudEl = new Audio();
  return cloudEl;
}

/** WAV mudo de ~0,05s, usado só para destravar o áudio no toque do usuário. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/**
 * Chamado no toque do usuário (ex.: enviar mensagem) para liberar a leitura
 * automática que só chega depois, quando a resposta volta do servidor.
 */
export function primeSpeech() {
  if (typeof window === "undefined") return;
  if (ttsSupported()) {
    try {
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    } catch {
      // no-op
    }
  }
  const el = cloudElement();
  try {
    el.muted = true;
    el.src = SILENT_WAV;
    void el
      .play()
      .then(() => {
        el.pause();
        el.muted = false;
      })
      .catch(() => {
        el.muted = false;
      });
  } catch {
    el.muted = false;
  }
}

async function playCloudChunk(src: string, rate: number): Promise<CloudChunk> {
  const el = cloudElement();
  el.muted = false;
  el.src = src;
  el.playbackRate = rate;
  currentCloudAudio = el;
  // A promessa é criada junto com o áudio: se ele terminar antes de o próximo
  // bloco chegar da nuvem, o fim já está registrado e a fila não trava.
  const finished = new Promise<void>((resolve) => {
    const done = () => resolve();
    el.addEventListener("ended", done, { once: true });
    el.addEventListener("error", done, { once: true });
  });
  await el.play();
  return { el, finished };
}


async function speakCloud(
  text: string,
  lang?: string,
  origin?: TtsOrigin,
  actionId?: string,
  playbackRate = getRate(),
  videoId?: string,
  repeatText?: string,
  chatMessageId?: string,
): Promise<SpeakResult> {
  stopSpeaking();
  const token = ++queueToken;
  try {
    queueActive = true;
    const rate = playbackRate;
    // Gemini reads the entire card in one request and one continuous voice.
    if (!text) {
      queueActive = false;
      return { ok: false, reason: "empty" };
    }

    const isCurrent = () => token === queueToken;
    // Long notes/answers exceed the per-request limits (4000 chars / 90 s),
    // so they are read in ordered parts; short texts stay one continuous request.
    const parts = text.length > 1200 && !videoId && !chatMessageId
      ? splitTextForSpeech(text, { target: 900, max: 1200 })
      : [text];
    const fetchPart = (i: number) => queuedCloudAudio(parts[i]!, lang, origin, actionId, isCurrent, 1, videoId, i === 0 ? repeatText : undefined, chatMessageId);

    const first = await fetchPart(0);
    if (!isCurrent() || !first) return { ok: false, reason: "empty" };
    const current = await playCloudChunk(first.src, rate);

    void (async () => {
      try {
        let playing = current;
        for (let i = 1; i < parts.length; i++) {
          const next = fetchPart(i);
          await playing.finished;
          const audio = await next;
          if (!isCurrent() || !audio) return;
          playing = await playCloudChunk(audio.src, rate);
        }
        await playing.finished;
      } catch {
        /* stop silently on a later-part failure */
      } finally {
        if (isCurrent()) queueActive = false;
      }
    })();

    return { ok: true, source: "cloud", audio: current.el };
  } catch (err) {
    if (token !== queueToken) return { ok: false, reason: "empty" };
    currentCloudAudio = null;
    queueActive = false;
    return {
      ok: false,
      reason: "cloud-error",
      message: err instanceof Error ? err.message : "Falha ao gerar voz na nuvem",
    };
  }
}

// ---------------------------------------------------------------------------
// Fase 3 — voz local multilíngue.
// Só entra em ação quando existe idioma explícito diferente de português.
// Sem `lang` (ou com pt*), o caminho abaixo é exatamente o anterior.
// ---------------------------------------------------------------------------

/** Ordem de preferência por idioma; não pressupõe que o aparelho tenha alguma delas. */
const REGION_PREFERENCE: Record<string, string[]> = {
  en: ["en-US", "en-GB", "en-AU", "en-CA", "en-IE", "en-IN", "en-ZA"],
  es: ["es-ES", "es-MX", "es-US", "es-AR", "es-CO", "es-CL"],
  fr: ["fr-FR", "fr-CA", "fr-BE", "fr-CH"],
  it: ["it-IT", "it-CH"],
  de: ["de-DE", "de-AT", "de-CH"],
  pt: ["pt-BR", "pt-PT"],
};

export function primarySubtag(lang?: string | null): string {
  if (!lang) return "";
  return normalizeLang(lang).split("-")[0]!.toLowerCase();
}

function localeVoiceScore(voice: SpeechSynthesisVoice, lang: string): number {
  const voiceLang = normalizeLang(voice.lang).toLowerCase();
  const wanted = normalizeLang(lang).toLowerCase();
  const primary = primarySubtag(lang);
  if (primarySubtag(voiceLang) !== primary) return -1;

  let score = 10;
  if (voiceLang === wanted) score += 100;
  const prefs = REGION_PREFERENCE[primary] ?? [];
  const idx = prefs.findIndex((p) => p.toLowerCase() === voiceLang);
  if (idx >= 0) score += 60 - idx * 5;
  if (voice.localService) score += 3;
  if (voice.default) score += 1;
  return score;
}

/** Escolha determinística: melhor pontuação e, em caso de empate, nome em ordem. */
export function chooseVoiceForLang(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null {
  const ranked = voices
    .map((voice) => ({ voice, score: localeVoiceScore(voice, lang) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => (b.score - a.score) || a.voice.name.localeCompare(b.voice.name, "en"));
  return ranked[0]?.voice ?? null;
}

const langVoiceCache = new Map<string, SpeechSynthesisVoice | null>();

if (typeof window !== "undefined" && ttsSupported()) {
  window.speechSynthesis.addEventListener("voiceschanged", () => langVoiceCache.clear());
}

// ---------------------------------------------------------------------------
// Fase 5 — fila contínua para textos longos.
// Texto curto = um único bloco (comportamento idêntico ao anterior).
// ---------------------------------------------------------------------------

let queueToken = 0;
let queueActive = false;


/** Fala os blocos em sequência: o bloco seguinte só começa quando o anterior termina. */
function speakSequential(
  chunks: string[],
  configure: (u: SpeechSynthesisUtterance) => void,
) {
  window.speechSynthesis.cancel();
  const token = ++queueToken;

  queueActive = chunks.length > 0;

  const speakAt = (index: number) => {
    if (token !== queueToken) return; // interrompido por stopSpeaking/nova fala
    const chunk = chunks[index];
    if (!chunk) { queueActive = false; return; }
    const utterance = new SpeechSynthesisUtterance(chunk);
    configure(utterance);
    utterance.onend = () => {
      if (token !== queueToken) return;
      speakAt(index + 1);
    };
    utterance.onerror = () => {
      if (token === queueToken) queueActive = false;
    };
    window.speechSynthesis.speak(utterance);
  };

  speakAt(0);
}

async function speakInLanguage(
  cleanText: string,
  lang: string,
  rate: number,
  origin?: TtsOrigin,
  actionId?: string,
): Promise<SpeakResult> {
  const key = normalizeLang(lang).toLowerCase();
  let voice = langVoiceCache.get(key);
  if (voice === undefined) {
    voice = chooseVoiceForLang(listVoices(), lang);
    if (!voice) voice = chooseVoiceForLang(await loadVoices(), lang);
    langVoiceCache.set(key, voice);
  }

  // Sem voz compatível instalada, o áudio em nuvem fala no idioma correto (Fase 6).
  if (!voice) return speakCloud(cleanText, normalizeLang(lang), origin, actionId);

  try {
    const utteranceLang = normalizeLang(voice.lang) || normalizeLang(lang);
    speakSequential(splitTextForSpeech(cleanText), (utterance) => {
      utterance.voice = voice!;
      utterance.lang = utteranceLang;
      utterance.rate = rate;
      utterance.pitch = 1;
    });
    return { ok: true, source: "browser", voiceName: voice.name, voiceLang: voice.lang };
  } catch {
    return { ok: false, reason: "unsupported" };
  }
}

/**
 * Narração de vídeo com a voz instalada no navegador, usada só depois que o TTS
 * em nuvem falhou. Nunca cai para a nuvem: sem voz no idioma, retorna falha.
 */
export async function speakVideoWithBrowserVoice(text: string, lang: string): Promise<boolean> {
  if (!ttsSupported()) return false;
  const cleanText = prepareForSpeech(text.trim());
  if (!cleanText) return false;
  const key = normalizeLang(lang).toLowerCase();
  let voice = langVoiceCache.get(key);
  if (voice === undefined) {
    voice = chooseVoiceForLang(listVoices(), lang);
    if (!voice) voice = chooseVoiceForLang(await loadVoices(), lang);
    langVoiceCache.set(key, voice);
  }
  if (!voice) return false;
  try {
    const utteranceLang = normalizeLang(voice.lang) || normalizeLang(lang);
    const rate = getRate();
    speakSequential(splitTextForSpeech(cleanText), (utterance) => {
      utterance.voice = voice!;
      utterance.lang = utteranceLang;
      utterance.rate = rate;
      utterance.pitch = 1;
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Lacunas de cards de completar (`________`) viram a palavra "blank" na fala:
 * sem isso, a voz soletra "underscore, underscore…". Aplicado uma única vez na
 * entrada de speak(), cobrindo voz do navegador e nuvem. O texto exibido na
 * tela nunca é alterado.
 */
export async function speak(text: string, options?: SpeakOptions): Promise<SpeakResult> {
  const cleanText = prepareForSpeech(text.trim());
  if (!cleanText) return { ok: false, reason: "empty" };
  const rate = options?.rate && options.rate > 0 ? options.rate : getRate();
  const lang = options?.lang ? normalizeLang(options.lang) : "";
  const primary = primarySubtag(lang);
  if (options?.videoId) return speakCloud(cleanText, lang || undefined, options.origin, options.actionId, rate, options.videoId);

  try {
    providerChoice ??= speechProvider();
    if ((await providerChoice).googleCloud) return speakCloud(cleanText, lang || undefined, options?.origin, options?.actionId, rate, undefined, options?.repeatText, options?.chatMessageId);
  } catch (error) {
    providerChoice = undefined;
    return { ok: false, reason: "cloud-error", message: error instanceof Error ? error.message : "Falha ao consultar o serviço de áudio." };
  }

  if (!ttsSupported()) return speakCloud(cleanText, lang || undefined, options?.origin, options?.actionId, rate);

  // Idioma explícito não português → seleção multilíngue.
  if (primary && primary !== "pt") {
    return speakInLanguage(cleanText, lang, rate, options?.origin, options?.actionId);
  }

  const speakWithVoice = (voice: SpeechSynthesisVoice | null): SpeakResult => {
    try {
      const utteranceLang =
        voice && /^pt-BR\b/i.test(normalizeLang(voice.lang)) ? normalizeLang(voice.lang) : "pt-BR";
      speakSequential(splitTextForSpeech(cleanText), (utterance) => {
        if (voice) utterance.voice = voice;
        utterance.lang = utteranceLang;
        utterance.rate = rate;
        utterance.pitch = 1;
      });
      return { ok: true, source: "browser", voiceName: voice?.name ?? "Voz padrão do sistema", voiceLang: voice?.lang ?? "pt-BR" };
    } catch {
      return { ok: false, reason: "unsupported" };
    }
  };

  const immediate = pickVoice();
  if (immediate) return speakWithVoice(immediate);

  // Voices may not be loaded yet; wait briefly and pick the best Portuguese voice.
  const voices = await loadVoices();
  cachedVoice = choosePortugueseVoice(voices);
  if (cachedVoice) return speakWithVoice(cachedVoice);

  // Android/Samsung sometimes reports empty voice list even with PT-BR configured:
  // trust the device default if the browser locale is Portuguese.
  if (isAndroidBrowser() && browserPrefersPortuguese()) {
    return speakWithVoice(null);
  }

  // No free browser PT-BR voice available → fall back to Lovable AI TTS (cheapest tier).
  return speakCloud(cleanText, undefined, options?.origin, options?.actionId);
}

export function portugueseVoiceHelpMessage(): string {
  return "Nenhuma voz PT-BR gratuita foi encontrada. Usando a voz da nuvem.";
}

export function stopSpeaking() {
  if (currentCloudAudio) {
    try { currentCloudAudio.pause(); currentCloudAudio.currentTime = 0; } catch { /* no-op */ }
    currentCloudAudio = null;
  }
  queueToken++; // invalida a fila de blocos em andamento (Fase 5)
  queueActive = false;
  if (!ttsSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // no-op
  }
}

export function isSpeaking(): boolean {
  if (queueActive) return true;
  if (currentCloudAudio && !currentCloudAudio.paused && !currentCloudAudio.ended) return true;
  if (ttsSupported()) {
    try { return window.speechSynthesis.speaking; } catch { return false; }
  }
  return false;
}

export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}
