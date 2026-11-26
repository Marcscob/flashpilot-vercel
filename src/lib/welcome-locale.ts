import { matchBlogTag } from "./blog-langs";

/** Keep explicit language choices; use the browser region only for the same language. */
export function welcomeLocale(language: string, browserTags: readonly string[] = []): string {
  const selected = matchBlogTag(language) ?? "en";
  if (language.includes("-") && matchBlogTag(language)) {
    try {
      return Intl.getCanonicalLocales(language)[0] ?? selected;
    } catch {
      return selected;
    }
  }
  if (selected.includes("-")) return selected;
  for (const tag of browserTags) {
    const matched = matchBlogTag(tag);
    if (matched && matched.split("-")[0] === selected.split("-")[0]) {
      try {
        return Intl.getCanonicalLocales(tag)[0] ?? selected;
      } catch {
        /* next tag */
      }
    }
  }
  return selected === "pt" ? "pt-BR" : selected;
}

export function authEmailRedirectUrl(origin: string, language: string, resume = false): string {
  const url = new URL("/", origin);
  if (resume) url.searchParams.set("resume", "1");
  url.searchParams.set("lang", language);
  return url.toString();
}

export function welcomeDirection(locale: string): "rtl" | "ltr" {
  return /^(ar|he|fa)(-|$)/.test(locale) ? "rtl" : "ltr";
}
