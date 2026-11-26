import { createServerFn } from "@tanstack/react-start";

import {
  FALLBACK_LANG,
  LANG_COOKIE,
  LANG_MANUAL_COOKIE,
  isLang,
  matchAcceptLanguage,
  type Lang,
} from "./lang-match";
import {
  EXT_LANG_COOKIE,
  matchAppAcceptLanguage,
  resolveManualAppLocale,
  type AppLocale,
} from "./app-ext-langs";

export const getInitialAppLocale = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppLocale> => {
    const { getCookie, getRequestHeader } = await import("@tanstack/react-start/server");
    try {
      const saved = getCookie(LANG_COOKIE);
      const manual = getCookie(LANG_MANUAL_COOKIE) === "1";
      const manualLocale = resolveManualAppLocale(manual, saved, getCookie(EXT_LANG_COOKIE));
      if (manualLocale) return manualLocale;
      return matchAppAcceptLanguage(getRequestHeader("accept-language"));
    } catch {
      return { lang: FALLBACK_LANG, extLang: null };
    }
  },
);

/**
 * Resolve o idioma inicial no servidor (escolha manual → Accept-Language),
 * para que a preferência automática acompanhe visitantes em outra região.
 */
export const getInitialLang = createServerFn({ method: "GET" }).handler(async (): Promise<Lang> => {
  const { getCookie, getRequestHeader } = await import("@tanstack/react-start/server");
  try {
    const saved = getCookie(LANG_COOKIE);
    if (getCookie(LANG_MANUAL_COOKIE) === "1" && isLang(saved)) return saved;
    return matchAcceptLanguage(getRequestHeader("accept-language"));
  } catch {
    return FALLBACK_LANG;
  }
});

/** Idioma do blog no servidor: escolha manual → variante exata do Accept-Language → idioma do app. */
export const getInitialBlogLang = createServerFn({ method: "GET" }).handler(
  async (): Promise<string> => {
    const { getCookie, getRequestHeader } = await import("@tanstack/react-start/server");
    const { matchBlogAcceptLanguage, findBlogLang } = await import("./blog-langs");
    try {
      const picked = getCookie("fp_blog_lang");
      if (picked && findBlogLang(picked)) return picked;
      const variant = getCookie("fp_variant_lang");
      if (variant && findBlogLang(variant)) return variant;
      const saved = getCookie(LANG_COOKIE);
      const header = getRequestHeader("accept-language");
      const fromBrowser = matchBlogAcceptLanguage(header);
      if (getCookie("fp_lang_picked") === "1" && isLang(saved)) {
        const base = fromBrowser ? findBlogLang(fromBrowser)?.base : undefined;
        return fromBrowser && (fromBrowser === saved || base === saved) ? fromBrowser : saved;
      }
      return fromBrowser ?? matchAcceptLanguage(header);
    } catch {
      return FALLBACK_LANG;
    }
  },
);
