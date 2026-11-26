/**
 * Idiomas extras da interface do app (além dos 7 nativos), carregados sob
 * demanda de /i18n/<code>.json. Variantes dos 7 nativos usam o idioma nativo.
 */
import { BLOG_LANGS, matchBlogTag, type BlogLangInfo } from "./blog-langs";
import {
  acceptLanguageTags,
  FALLBACK_LANG,
  isLang,
  matchBrowserLang,
  type Lang,
} from "./lang-match";

const NATIVE_ROOTS = new Set(["pt", "en", "es", "fr", "it", "de"]);

export const APP_EXT_LANGS: BlogLangInfo[] = BLOG_LANGS.filter(
  (l) => !NATIVE_ROOTS.has(l.code.split("-")[0]!.toLowerCase()),
);

export function isExtLang(code: string | null | undefined): boolean {
  return !!code && APP_EXT_LANGS.some((l) => l.code === code);
}

export type AppLocale = { lang: Lang; extLang: string | null };

/** Resolve the first supported locale from ordered browser preferences. */
export function matchAppLocale(tags: readonly string[]): AppLocale {
  for (const tag of tags) {
    const native = matchBrowserLang([tag]);
    if (native) return { lang: native, extLang: null };

    const matched = matchBlogTag(tag);
    if (matched && isExtLang(matched)) return { lang: FALLBACK_LANG, extLang: matched };
  }
  return { lang: FALLBACK_LANG, extLang: null };
}

export function matchAppAcceptLanguage(header: string | undefined | null): AppLocale {
  return matchAppLocale(acceptLanguageTags(header));
}

/** A manually saved app language always takes precedence over browser settings. */
export function resolveManualAppLocale(
  manual: boolean,
  savedLang: unknown,
  savedExtLang: unknown,
): AppLocale | null {
  if (!manual || !isLang(savedLang)) return null;
  const extLang = typeof savedExtLang === "string" ? savedExtLang : null;
  if (savedLang === "en" && isExtLang(extLang)) {
    return { lang: savedLang, extLang };
  }
  return { lang: savedLang, extLang: null };
}

export const EXT_LANG_COOKIE = "fp_ext_lang";

/** Código do painel → idioma nativo equivalente (variantes), ou null se for extra. */
export function nativeFor(code: string): Lang | null {
  if (
    code === "pt" ||
    code === "pt-PT" ||
    code === "en" ||
    code === "es" ||
    code === "fr" ||
    code === "it" ||
    code === "de"
  ) {
    return code;
  }
  const root = code.split("-")[0]!.toLowerCase();
  if (NATIVE_ROOTS.has(root)) return root as Lang;
  return null;
}

/**
 * Resolve qualquer um dos 52 idiomas e variantes do app (nativos, variantes regionais e extras).
 */
export function resolveRequestedAppLocale(requested: string | null | undefined): AppLocale | null {
  if (!requested) return null;
  const native = nativeFor(requested);
  if (native) return { lang: native, extLang: null };
  if (isExtLang(requested)) return { lang: FALLBACK_LANG, extLang: requested };
  return null;
}

export function isSupportedAppLang(code: string | null | undefined): boolean {
  return Boolean(resolveRequestedAppLocale(code));
}

export type ExtOverlay = { d: Record<string, string>; u: Record<string, string> };

const cache = new Map<string, Promise<ExtOverlay | null>>();
export function loadExtOverlay(code: string): Promise<ExtOverlay | null> {
  let p = cache.get(code);
  if (!p) {
    p = fetch(`/i18n/${code}.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<ExtOverlay>) : null))
      .catch(() => null);
    cache.set(code, p);
  }
  return p;
}

/** Copies dictionaries and applies translations to strings, arrays, and callback results. */
export function applyDictOverlay<T>(base: T, d: Record<string, string>, prefix = ""): T {
  if (!base || typeof base !== "object" || Array.isArray(base)) return base;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(base)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[k] = d[path] ?? v;
    else if (Array.isArray(v)) out[k] = applyDeepDictOverlay(v, d, path);
    else if (v && typeof v === "object" && !Array.isArray(v)) out[k] = applyDictOverlay(v, d, path);
    else if (typeof v === "function") {
      const source = v as (...args: unknown[]) => unknown;
      out[k] = (...args: unknown[]) => {
        const result = applyDeepDictOverlay(source(...args), d, path);
        const variables =
          args.find(
            (arg): arg is Record<string, unknown> =>
              Boolean(arg) && typeof arg === "object" && !Array.isArray(arg),
          ) ?? Object.fromEntries(args.map((arg, index) => [`arg${index}`, arg]));
        return replacePlaceholders(result, variables);
      };
    } else out[k] = v;
  }
  return out as T;
}

function replacePlaceholders(value: unknown, variables: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{(\w+)\}/g, (match, key: string) =>
      Object.hasOwn(variables, key) ? String(variables[key]) : match,
    );
  }
  if (Array.isArray(value)) return value.map((entry) => replacePlaceholders(entry, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replacePlaceholders(entry, variables)]),
    );
  }
  return value;
}

/** Applies overlay keys through objects and arrays using dotted/indexed paths. */
export function applyDeepDictOverlay<T>(base: T, d: Record<string, string>, prefix = ""): T {
  if (typeof base === "string") return (d[prefix] ?? base) as T;
  if (Array.isArray(base)) {
    return base.map((value, index) => applyDeepDictOverlay(value, d, `${prefix}.${index}`)) as T;
  }
  if (base && typeof base === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(base)) {
      const path = prefix ? `${prefix}.${key}` : key;
      out[key] = applyDeepDictOverlay(value, d, path);
    }
    return out as T;
  }
  return base;
}

export const EXT_LANG_KEY = "app-ext-lang";
