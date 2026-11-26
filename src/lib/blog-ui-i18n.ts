import { useCallback, useEffect, useMemo, useState } from "react";
import { applyDictOverlay, isExtLang, loadExtOverlay, type ExtOverlay } from "./app-ext-langs";
import { findBlogLang } from "./blog-langs";
import { DICTS } from "./i18n";
import { lookupUi } from "./i18n-ui";
import { isLang, type Lang } from "./lang-match";

type TranslationVars = Record<string, string | number>;

export function resolveBlogUiLocale(code: string): { lang: Lang; extLang: string | null } {
  const normalized = code === "pt-BR" ? "pt" : (findBlogLang(code)?.base ?? code);
  if (isLang(normalized)) return { lang: normalized, extLang: null };
  if (isExtLang(normalized)) return { lang: "en", extLang: normalized };
  return { lang: "en", extLang: null };
}

export function translateBlogUi(
  source: string,
  lang: Lang,
  overlay?: Record<string, string> | null,
  vars?: TranslationVars,
): string {
  const translated =
    overlay?.[source] ?? lookupUi(source, lang) ?? lookupUi(source, "en") ?? source;
  if (!vars) return translated;
  return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function useBlogUi(code: string) {
  const { lang, extLang } = resolveBlogUiLocale(code);
  const [loadedOverlay, setLoadedOverlay] = useState<{
    code: string;
    overlay: ExtOverlay | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    if (!extLang) {
      setLoadedOverlay(null);
      return () => {
        active = false;
      };
    }

    void loadExtOverlay(extLang).then((overlay) => {
      if (active) setLoadedOverlay({ code: extLang, overlay });
    });
    return () => {
      active = false;
    };
  }, [extLang]);

  const overlay = extLang && loadedOverlay?.code === extLang ? loadedOverlay.overlay : null;
  const t = useCallback(
    (source: string, vars?: TranslationVars) => translateBlogUi(source, lang, overlay?.u, vars),
    [lang, overlay],
  );
  const dictionary = useMemo(
    () => (extLang ? applyDictOverlay(DICTS.en, overlay?.d ?? {}) : DICTS[lang]),
    [extLang, lang, overlay],
  );

  return { t, dictionary };
}
