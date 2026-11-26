import { franc } from "franc-min";

const LOCALES: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR", it: "it-IT", de: "de-DE", ja: "ja-JP", ar: "ar-XA", he: "he-IL", fa: "fa-IR", ru: "ru-RU", zh: "cmn-CN", ko: "ko-KR", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR" };
const ISO: Record<string, string> = { por: "pt", eng: "en", spa: "es", fra: "fr", ita: "it", deu: "de", jpn: "ja", arb: "ar", heb: "he", pes: "fa", rus: "ru", cmn: "zh", kor: "ko", nld: "nl", pol: "pl", tur: "tr" };
const ENGLISH_TERMS = new Set("good morning evening night hello goodbye please thanks thank you cat dog book house apple water school friend love world how are welcome due process common law habeas corpus".split(" "));
export type SpeechSpan = { text: string; lang: string };
export type CloudVoice = { name: string; languageCodes: string[]; ssmlGender?: string };

export function speechLocale(lang = "pt-BR"): string {
  const normalized = lang.replace(/_/g, "-");
  return normalized.includes("-") ? normalized : LOCALES[normalized.toLowerCase()] ?? normalized;
}
export function escapeSsml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function detectSpan(text: string, base: string): string {
  if (/[\u3040-\u30ff]/u.test(text)) return "ja-JP";
  if (/[\u0600-\u06ff]/u.test(text)) return "ar-XA";
  if (/[\u0590-\u05ff]/u.test(text)) return "he-IL";
  if (/[\u4e00-\u9fff]/u.test(text)) return "cmn-CN";
  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (!base.startsWith("en") && words.length && words.every(w => ENGLISH_TERMS.has(w))) return "en-US";
  if (words.length < 6 || text.length < 40) return base;
  const primary = ISO[franc(text, { only: Object.keys(ISO), minLength: 25 })];
  return primary ? (primary === base.split("-")[0] ? base : LOCALES[primary] ?? base) : base;
}
/** Explicit HTML lang spans win; quoted/emphasized terms and sentences use local heuristics. */
export function speechSpans(text: string, lang?: string): SpeechSpan[] {
  const base = speechLocale(lang);
  const spans: SpeechSpan[] = [];
  const add = (part: string, forced?: string) => {
    const clean = part.replace(/<[^>]*>/g, "");
    if (!clean.trim()) return;
    spans.push({ text: clean, lang: forced ? speechLocale(forced) : detectSpan(clean, base) });
  };
  const pattern = /<([a-z][\w-]*)\b[^>]*\blang=["']([\w-]+)["'][^>]*>([\s\S]*?)<\/\1>|<i\b[^>]*>([\s\S]*?)<\/i>|<em\b[^>]*>([\s\S]*?)<\/em>|["“«]([^"”»]+)["”»]|'([^'\n]+)'|\b(good morning|good evening|good night|thank you|due process|common law)\b/gi;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    for (const part of text.slice(offset, match.index).split(/(?<=[.!?;:\n])\s+/)) add(part);
    add(match[3] ?? match[4] ?? match[5] ?? match[6] ?? match[7] ?? match[8] ?? "", match[2]);
    offset = (match.index ?? 0) + match[0].length;
  }
  for (const part of text.slice(offset).split(/(?<=[.!?;:\n])\s+/)) add(part);
  return spans;
}
export type SpeechSegment = { voice: string; languageCode: string; input: { text: string } | { ssml: string } };
// Female voices only (product preference). Google's Polyglot voices are all male, so they are skipped
// and bilingual cards fall back to per-language female Standard voices.
const findVoice = (voices: CloudVoice[], locale: string, kind: string) =>
  voices.find(v => v.languageCodes.includes(locale) && v.name.includes(kind) && (v.ssmlGender ?? "FEMALE") === "FEMALE");
/**
 * Monolingual → that language's Standard voice. Bilingual → Polyglot: one SSML request when the
 * base language has a Polyglot voice; otherwise each language span is synthesized by its own native
 * voice (Polyglot where Google offers it, else Standard) so no language is read with a foreign accent.
 */
export function googleSpeechPlan(text: string, lang: string | undefined, voices: CloudVoice[]) {
  const locale = speechLocale(lang);
  const spans = speechSpans(text, lang);
  const bilingual = new Set(spans.map(s => s.lang.split("-")[0])).size > 1;
  if (!bilingual) {
    const spokenLocale = spans[0]?.lang ?? locale;
    const selected = findVoice(voices, spokenLocale, "Standard");
    if (!selected) throw new Error(`Google TTS: voz Standard indisponível para ${spokenLocale}.`);
    const segments: SpeechSegment[] = [{ voice: selected.name, languageCode: spokenLocale, input: { text: spans.map(s => s.text).join(" ") } }];
    return { bilingual, voice: selected.name, languageCode: spokenLocale, segments };
  }
  const polyglot = findVoice(voices, locale, "Polyglot");
  if (polyglot) {
    const ssml = `<speak>${spans.map(s => `<lang xml:lang="${escapeSsml(s.lang)}">${escapeSsml(s.text)}</lang>`).join(" ")}</speak>`;
    return { bilingual, voice: polyglot.name, languageCode: locale, segments: [{ voice: polyglot.name, languageCode: locale, input: { ssml } }] as SpeechSegment[] };
  }
  const segments: SpeechSegment[] = [];
  for (const s of spans) {
    const v = findVoice(voices, s.lang, "Polyglot") ?? findVoice(voices, s.lang, "Standard");
    if (!v) throw new Error(`Google TTS: voz Polyglot/Standard indisponível para ${s.lang}.`);
    const last = segments[segments.length - 1];
    if (last && last.voice === v.name && "text" in last.input) last.input.text += ` ${s.text}`;
    else segments.push({ voice: v.name, languageCode: s.lang, input: { text: s.text } });
  }
  return { bilingual, voice: segments.map(s => s.voice).join("+"), languageCode: locale, segments };
}