import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import {
  BLOG_LANGS,
  findBlogLang,
  localizedLangName,
  pickClientBlogLang,
  setPickedBlogLang,
  BLOG_LANG_EVENT,
} from "@/lib/blog-langs";
import { useLang } from "@/lib/i18n";
import { useBlogUi } from "@/lib/blog-ui-i18n";
import { FlagIcon } from "@/components/FlagIcon";

/**
 * Painel de idiomas do blog: grade com bandeira + sigla + nome, com busca.
 * Mostra somente os idiomas oficiais do blog (BLOG_LANGS, já sem desperdícios).
 */
export function BlogLanguagePanel({ initialLang = "en" }: { initialLang?: string }) {
  const { lang: uiLang } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(initialLang);
  const { t } = useBlogUi(current);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrent(pickClientBlogLang(uiLang));
  }, [uiLang]);

  useEffect(() => {
    const onChanged = () => setCurrent(pickClientBlogLang(uiLang));
    window.addEventListener(BLOG_LANG_EVENT, onChanged);
    return () => window.removeEventListener(BLOG_LANG_EVENT, onChanged);
  }, [uiLang]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BLOG_LANGS;
    return BLOG_LANGS.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.label.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q),
    );
  }, [query]);

  const info = findBlogLang(current);
  const flag = info?.label.split(" ")[0] ?? "🌐";
  const code = current.toUpperCase();

  function choose(code: string) {
    setPickedBlogLang(code);
    setCurrent(code);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("Idioma do blog")}
        title={t("Idioma do blog")}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-stone-200 px-2 py-1 text-sm text-foreground/70 hover:text-foreground dark:border-stone-700"
      >
        <FlagIcon flag={flag} />
        <span className="font-medium">{code}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop em telas pequenas: fecha ao tocar fora */}
          <div
            className="fixed inset-0 z-40 bg-foreground/40 sm:hidden"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label={t("Escolha o idioma")}
            className="fixed left-1/2 top-20 z-50 w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900 sm:absolute sm:right-0 sm:left-auto sm:top-auto sm:mt-2 sm:w-[min(92vw,26rem)] sm:max-w-none sm:translate-x-0"
          >
            <div className="border-b border-stone-200 p-2 dark:border-stone-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Buscar idioma...")}
                  className="w-full rounded-lg border border-stone-300/60 bg-white py-1.5 pl-8 pr-3 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-amber-400 dark:border-stone-600/60 dark:bg-stone-800 dark:text-stone-100"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <p className="flex items-center justify-center gap-2 py-6 text-sm text-stone-400">
                  <Globe className="h-4 w-4" />
                  {t("Nenhum idioma encontrado")}
                </p>
              ) : (
                <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {filtered.map((l) => {
                    const lFlag = l.label.split(" ")[0];
                    const lNative = l.label.slice(lFlag.length).trim();
                    const localized = localizedLangName(l.code, current);
                    const lName = localized ?? lNative;
                    const secondary = localized && localized !== lNative ? lNative : null;
                    const active = l.code === current;
                    return (
                      <li key={l.code}>
                        <button
                          type="button"
                          onClick={() => choose(l.code)}
                          aria-pressed={active}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                            active
                              ? "bg-amber-100 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                          }`}
                        >
                          <FlagIcon flag={lFlag} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide">
                              {l.code}
                            </span>
                            <span className="block truncate text-xs opacity-80">{lName}</span>
                            {secondary && (
                              <span className="block truncate text-[10px] opacity-60">
                                {secondary}
                              </span>
                            )}
                          </span>
                          {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
