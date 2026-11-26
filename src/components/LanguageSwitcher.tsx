import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe, Search } from "lucide-react";
import { useLang, type Lang } from "@/lib/i18n";
import { nativeFor } from "@/lib/app-ext-langs";
import { BLOG_LANGS, localizedLangName } from "@/lib/blog-langs";
import { FlagIcon } from "@/components/FlagIcon";
import { T } from "@/lib/i18n-ui";

type Opt = { code: string; flag: string; name: string; nativeLang: Lang | null };

const VARIANT_KEY = "app-variant-lang";
const VARIANT_COOKIE = "fp_variant_lang";

const OPTIONS: Opt[] = BLOG_LANGS.map((l) => {
  const parts = l.label.trim().split(/\s+/);
  const flag = parts[0] ?? "🌐";
  const name = parts.slice(1).join(" ");
  return {
    code: l.code,
    flag,
    name,
    nativeLang: nativeFor(l.code),
  };
});

function getSavedVariant(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VARIANT_KEY);
  } catch {
    return null;
  }
}

function persistVariant(code: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (code) window.localStorage.setItem(VARIANT_KEY, code);
    else window.localStorage.removeItem(VARIANT_KEY);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.cookie = code
      ? `${VARIANT_COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`
      : `${VARIANT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

/** Seletor de idioma do app: painel com bandeira + sigla + nome, com busca. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, extLang, setExtLang } = useLang();
  const [variant, setVariant] = useState<string | null>(getSavedVariant);
  const validVariant = variant && nativeFor(variant) === lang ? variant : null;
  const current = extLang ?? validVariant ?? lang;
  const info = OPTIONS.find((o) => o.code === current) ?? OPTIONS.find((o) => o.code === lang);
  const uiLang = extLang ?? lang;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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
    if (!q) return OPTIONS;
    return OPTIONS.filter((o) => o.code.toLowerCase().includes(q) || o.name.toLowerCase().includes(q));
  }, [query]);

  function choose(o: Opt) {
    if (o.nativeLang) {
      if (o.code === o.nativeLang) {
        setVariant(null);
        persistVariant(null);
      } else {
        setVariant(o.code);
        persistVariant(o.code);
      }
      setLang(o.nativeLang);
    } else {
      setVariant(null);
      persistVariant(null);
      setExtLang(o.code);
    }
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
        aria-label={T("Escolha o idioma")}
        title={T("Escolha o idioma")}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm text-foreground/70 hover:text-foreground"
      >
        {info && <FlagIcon flag={info.flag} />}
        <span className="font-medium">{current.toUpperCase()}</span>
        {!compact && info && <span className="hidden sm:inline">{localizedLangName(info.code, uiLang) ?? info.name}</span>}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          {/* Backdrop em telas pequenas: fecha ao tocar fora */}
          <div className="fixed inset-0 z-40 bg-foreground/40 sm:hidden" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={T("Escolha o idioma")}
            className="fixed left-1/2 top-20 z-50 w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl sm:absolute sm:end-0 sm:left-auto sm:top-auto sm:mt-2 sm:w-[min(92vw,26rem)] sm:max-w-none sm:translate-x-0"
          >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={T("Buscar idioma...")}
                className="w-full rounded-lg border border-input bg-background py-1.5 ps-8 pe-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Globe className="h-4 w-4" />
                {T("Nenhum idioma encontrado")}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {filtered.map((o) => {
                  const active = o.code === current;
                  const localized = localizedLangName(o.code, uiLang);
                  const shown = localized ?? o.name;
                  const secondary = localized && localized !== o.name ? o.name : null;
                  return (
                    <li key={o.code}>
                      <button
                        type="button"
                        onClick={() => choose(o)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition ${
                          active ? "bg-primary/15 font-semibold text-primary" : "hover:bg-muted"
                        }`}
                      >
                        <FlagIcon flag={o.flag} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide">{o.code}</span>
                          <span className="block truncate text-xs opacity-80">{shown}</span>
                          {secondary && <span className="block truncate text-[10px] opacity-60">{secondary}</span>}
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
