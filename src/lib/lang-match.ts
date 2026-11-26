/**
 * Detecção de idioma pura (sem React, sem browser) — usada tanto no cliente
 * quanto no servidor (SSR, via cabeçalho Accept-Language).
 */

export type Lang = "pt" | "pt-PT" | "es" | "en" | "fr" | "it" | "de";

export const ALL_LANGS: Lang[] = ["pt", "pt-PT", "es", "en", "fr", "it", "de"];

export const LANG_COOKIE = "fp_lang";
export const LANG_MANUAL_COOKIE = "fp_lang_manual";

/** Fallback quando o idioma do visitante não é oferecido. */
export const FALLBACK_LANG: Lang = "en";

/** Regiões de língua portuguesa que usam a variante europeia. */
const PT_EUROPEAN_REGIONS = new Set(["pt", "ao", "mz", "cv", "gw", "st", "tl", "mo"]);

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (ALL_LANGS as string[]).includes(value);
}

/**
 * Idioma do navegador/cabeçalho → idioma suportado. `null` se nenhum bater.
 * Apenas a preferência principal: se o idioma principal do navegador não é
 * oferecido, não olhamos tags secundárias herdadas do sistema operacional —
 * o visitante cai no fallback (inglês).
 */
export function matchBrowserLang(tags: readonly string[]): Lang | null {
  const tag = tags.map((raw) => raw.toLowerCase().trim()).find(Boolean);
  if (!tag) return null;
  const [root, region] = tag.split(/[-_]/);
  if (root === "pt") {
    if (region && PT_EUROPEAN_REGIONS.has(region)) return "pt-PT";
    return "pt";
  }
  if (root === "es") return "es";
  if (root === "en") return "en";
  if (root === "fr") return "fr";
  if (root === "it") return "it";
  if (root === "de") return "de";
  return null;
}

/** Accept-Language → tags ordenadas por preferência. */
export function acceptLanguageTags(header: string | undefined | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: (tag ?? "").trim(), weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.tag);
}

/** Accept-Language ("pt-PT,pt;q=0.9,en;q=0.7") → idioma suportado. */
export function matchAcceptLanguage(header: string | undefined | null): Lang {
  return matchBrowserLang(acceptLanguageTags(header)) ?? FALLBACK_LANG;
}
