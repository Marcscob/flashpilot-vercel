/**
 * Idiomas do blog (mais amplo que a interface do app).
 * Para acrescentar um idioma ou variante, basta incluir uma linha aqui.
 * `base` = idioma de origem da variante (ajuste regional leve).
 */
export type BlogLangInfo = {
  code: string;
  label: string;
  name: string;
  base?: string;
  dir?: "rtl";
};

export const BLOG_LANGS: BlogLangInfo[] = [
  // Português
  { code: "pt", label: "🇧🇷 Português (BR)", name: "Brazilian Portuguese" },
  { code: "pt-PT", label: "🇵🇹 Português (PT)", name: "European Portuguese (Portugal)", base: "pt" },
  // English
  { code: "en", label: "🇺🇸 English", name: "American English" },
  {
    code: "en-GB",
    label: "🇬🇧 English (UK)",
    name: "British English (UK spelling and vocabulary)",
    base: "en",
  },
  // Español
  { code: "es", label: "🌎 Español (LatAm)", name: "neutral Latin American Spanish" },
  { code: "es-AR", label: "🇦🇷 Español (AR)", name: "Argentine Spanish (voseo)", base: "es" },
  {
    code: "es-ES",
    label: "🇪🇸 Español (ES)",
    name: "European Spanish (Spain: ordenador, móvil, vosotros)",
    base: "es",
  },
  // Français
  { code: "fr", label: "🇫🇷 Français", name: "French" },
  { code: "fr-CA", label: "🇨🇦 Français (CA)", name: "Canadian French (Québec)", base: "fr" },
  // Italiano
  { code: "it", label: "🇮🇹 Italiano", name: "Italian" },
  // Deutsch
  { code: "de", label: "🇩🇪 Deutsch", name: "German" },
  { code: "de-AT", label: "🇦🇹 Deutsch (AT)", name: "Austrian German", base: "de" },
  {
    code: "de-CH",
    label: "🇨🇭 Deutsch (CH)",
    name: "Swiss Standard German (formal written Hochdeutsch, NOT Swiss dialect; never use ß, always ss)",
    base: "de",
  },
  // Chinês
  { code: "zh-CN", label: "🇨🇳 简体中文", name: "Simplified Chinese (Mandarin)" },
  { code: "zh-TW", label: "🇹🇼 繁體中文", name: "Traditional Chinese (Taiwan)", base: "zh-CN" },
  {
    code: "zh-HK",
    label: "🇭🇰 繁體中文 (HK)",
    name: "Traditional Chinese (Hong Kong)",
    base: "zh-TW",
  },
  // Demais idiomas
  { code: "ja", label: "🇯🇵 日本語", name: "Japanese" },
  { code: "ko", label: "🇰🇷 한국어", name: "Korean" },
  { code: "ar", label: "🇸🇦 العربية", name: "Modern Standard Arabic", dir: "rtl" },
  { code: "he", label: "🇮🇱 עברית", name: "Hebrew", dir: "rtl" },
  { code: "fa", label: "🇮🇷 فارسی", name: "Persian (Farsi)", dir: "rtl" },
  { code: "tr", label: "🇹🇷 Türkçe", name: "Turkish" },
  { code: "ru", label: "🇷🇺 Русский", name: "Russian" },
  { code: "uk", label: "🇺🇦 Українська", name: "Ukrainian" },
  { code: "pl", label: "🇵🇱 Polski", name: "Polish" },
  { code: "cs", label: "🇨🇿 Čeština", name: "Czech" },
  { code: "sk", label: "🇸🇰 Slovenčina", name: "Slovak" },
  { code: "hu", label: "🇭🇺 Magyar", name: "Hungarian" },
  { code: "ro", label: "🇷🇴 Română", name: "Romanian" },
  { code: "bg", label: "🇧🇬 Български", name: "Bulgarian" },
  { code: "hr", label: "🇭🇷 Hrvatski", name: "Croatian" },
  { code: "bs", label: "🇧🇦 Bosanski", name: "Bosnian" },
  { code: "sq", label: "🇦🇱 Shqip", name: "Albanian" },
  { code: "el", label: "🇬🇷 Ελληνικά", name: "Greek" },
  { code: "lt", label: "🇱🇹 Lietuvių", name: "Lithuanian" },
  { code: "lv", label: "🇱🇻 Latviešu", name: "Latvian" },
  { code: "et", label: "🇪🇪 Eesti", name: "Estonian" },
  { code: "fi", label: "🇫🇮 Suomi", name: "Finnish" },
  { code: "sv", label: "🇸🇪 Svenska", name: "Swedish" },
  { code: "da", label: "🇩🇰 Dansk", name: "Danish" },
  { code: "nb", label: "🇳🇴 Norsk (Bokmål)", name: "Norwegian Bokmål" },
  { code: "is", label: "🇮🇸 Íslenska", name: "Icelandic" },
  { code: "nl", label: "🇳🇱 Nederlands", name: "Dutch" },
  { code: "af", label: "🇿🇦 Afrikaans", name: "Afrikaans" },
  { code: "ca", label: "🏴 Català", name: "Catalan" },
  { code: "gl", label: "🏴 Galego", name: "Galician" },
  { code: "ga", label: "🇮🇪 Gaeilge", name: "Irish (Gaelic)" },
  { code: "hy", label: "🇦🇲 Հայերեն", name: "Armenian" },
  { code: "ka", label: "🇬🇪 ქართული", name: "Georgian" },
  { code: "az", label: "🇦🇿 Azərbaycan", name: "Azerbaijani" },
  { code: "tk", label: "🇹🇲 Türkmen", name: "Turkmen" },
  { code: "uz", label: "🇺🇿 Oʻzbek", name: "Uzbek" },
  // hi, id e fil removidos temporariamente: traduções pendentes (créditos de IA esgotados).
];

export const BLOG_LANG_CODES = BLOG_LANGS.map((l) => l.code) as [string, ...string[]];

export function findBlogLang(code: string | null | undefined): BlogLangInfo | undefined {
  return BLOG_LANGS.find((l) => l.code === code);
}

const PT_EUROPEAN = new Set(["pt", "ao", "mz", "cv", "gw", "st", "tl", "mo"]);
const ZH_TRAD = new Set(["tw", "hk", "mo", "hant"]);

/** Tag do navegador (es-MX, de-CH, zh-Hant-TW…) → código do blog, ou null. */
export function matchBlogTag(raw: string): string | null {
  const tag = raw.trim();
  if (!tag) return null;
  const parts = tag.toLowerCase().split(/[-_]/);
  const base = parts[0]!;
  const region = parts[parts.length - 1];
  if (base === "pt") return parts[1] && PT_EUROPEAN.has(parts[1]) ? "pt-PT" : "pt";
  if (base === "zh") {
    if (parts.includes("hk")) return "zh-HK";
    return parts.slice(1).some((p) => ZH_TRAD.has(p)) ? "zh-TW" : "zh-CN";
  }
  if (base === "no" || base === "nn") return "nb";
  // Variantes que herdam outra versão (sem tradução própria).
  if (base === "es" && (region === "uy" || region === "py")) return "es-AR";
  if (base === "en" && ["au", "nz", "ie", "za", "in"].includes(region ?? "")) return "en-GB";
  // "tl" (tagalog) mapeava para "fil", removido temporariamente: cai no fallback.
  if (parts.length > 1) {
    const exact = BLOG_LANGS.find((l) => l.code.toLowerCase() === `${base}-${region}`);
    if (exact) return exact.code;
  }
  return BLOG_LANGS.some((l) => l.code === base) ? base : null;
}

export function matchBlogTags(tags: readonly string[]): string | null {
  for (const t of tags) {
    const m = matchBlogTag(t);
    if (m) return m;
  }
  return null;
}

export function matchBlogAcceptLanguage(header: string | null | undefined): string | null {
  if (!header) return null;
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: (tag ?? "").trim(), w: q ? Number.parseFloat(q.slice(2)) || 0 : 1 };
    })
    .filter((e) => e.tag && e.tag !== "*")
    .sort((a, b) => b.w - a.w)
    .map((e) => e.tag);
  return matchBlogTags(tags);
}

/** Escolha explícita feita no painel de idiomas do blog (qualquer idioma do catálogo). */
export const BLOG_LANG_KEY = "blog-lang-picked";
export const BLOG_LANG_EVENT = "blog-lang-changed";

/** Espelho da escolha em cookie, para o servidor renderizar já no idioma escolhido. */
export const BLOG_LANG_COOKIE = "fp_blog_lang";

function writeBlogLangCookie(code: string): void {
  document.cookie = `${BLOG_LANG_COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`;
}

export function getPickedBlogLang(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(BLOG_LANG_KEY);
    const valid = v && BLOG_LANGS.some((l) => l.code === v) ? v : null;
    // Escolhas antigas só existiam no localStorage: sincroniza o cookie.
    if (valid && !document.cookie.includes(`${BLOG_LANG_COOKIE}=${valid}`))
      writeBlogLangCookie(valid);
    return valid;
  } catch {
    return null;
  }
}

export function setPickedBlogLang(code: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BLOG_LANG_KEY, code);
  } catch {
    /* modo privado pode bloquear */
  }
  writeBlogLangCookie(code);
  window.dispatchEvent(new Event(BLOG_LANG_EVENT));
}

/**
 * Idioma do blog no navegador: escolha feita no painel do blog vence tudo;
 * senão, escolha feita no seletor do app (mantendo a variante regional);
 * senão, idioma/variante exatos do navegador; senão, idioma da interface.
 */
export function pickClientBlogLang(uiLang: string): string {
  if (typeof window === "undefined") return uiLang;
  const blogPicked = getPickedBlogLang();
  if (blogPicked) return blogPicked;
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const fromBrowser = matchBlogTags(langs);
  let picked = false;
  try {
    picked = window.localStorage.getItem("app-lang-picked") === "1";
  } catch {
    /* ignore */
  }
  if (picked) {
    // Escolha manual vence, mas mantém a variante regional do mesmo idioma.
    const info = fromBrowser ? findBlogLang(fromBrowser) : undefined;
    return fromBrowser && (fromBrowser === uiLang || info?.base === uiLang) ? fromBrowser : uiLang;
  }
  return fromBrowser ?? uiLang;
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

/**
 * Nome do idioma traduzido para o idioma da interface do usuário
 * (ex.: "ja" vira "Japonês" para quem usa o app em português).
 * Cai no nome nativo (endônimo) quando o navegador não conhece o código.
 */
export function localizedLangName(code: string, uiLang: string): string | null {
  try {
    const tag = uiLang === "pt" ? "pt-BR" : uiLang;
    let dn = displayNamesCache.get(tag);
    if (!dn) {
      dn = new Intl.DisplayNames([tag], { type: "language" });
      displayNamesCache.set(tag, dn);
    }
    const name = dn.of(code);
    return name && name.toLowerCase() !== code.toLowerCase() ? name : null;
  } catch {
    return null;
  }
}
