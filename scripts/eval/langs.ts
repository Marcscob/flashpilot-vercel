import { BLOG_LANGS } from "../../src/lib/blog-langs";

export type Lang = { code: string; name: string; base?: string; rtl?: boolean };

const EXTRA: Lang[] = [
  { code: "hi", name: "Hindi" },
  { code: "id", name: "Indonesian" },
  { code: "fil", name: "Filipino" },
];

export const LANGS: Lang[] = [
  ...BLOG_LANGS.map((l) => ({ code: l.code, name: l.name, base: l.base, rtl: l.dir === "rtl" })),
  ...EXTRA,
];

const S = (name: string) => new RegExp(`\\p{Script=${name}}`, "u");
const CYR = S("Cyrillic");
const AR = S("Arabic");
const HAN = S("Han");

/** Escrita esperada na saída; ausente = alfabeto latino. */
const SCRIPT: Record<string, RegExp[]> = {
  "zh-CN": [HAN], "zh-TW": [HAN], "zh-HK": [HAN],
  ja: [S("Hiragana"), S("Katakana"), HAN],
  ko: [S("Hangul")],
  ar: [AR], fa: [AR], he: [S("Hebrew")],
  ru: [CYR], uk: [CYR], bg: [CYR],
  el: [S("Greek")], hy: [S("Armenian")], ka: [S("Georgian")], hi: [S("Devanagari")],
};

const LATIN = /\p{Script=Latin}/u;

/** Fração das letras da saída que pertencem à escrita esperada do idioma. */
export function scriptShare(code: string, text: string): number {
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  const patterns = SCRIPT[code] ?? [LATIN];
  return letters.filter((c) => patterns.some((p) => p.test(c))).length / letters.length;
}

export const isLatinScript = (code: string) => !SCRIPT[code];
export const usesCharCount = (code: string) => ["zh-CN", "zh-TW", "zh-HK", "ja"].includes(code);

export const BASE_SENTENCE =
  "Photosynthesis is the process by which plants use sunlight, water and carbon dioxide to produce glucose and oxygen.";
