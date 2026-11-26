import { BLOG_LANGS } from "./blog-langs";

const FLAG_OVERRIDES: Record<string, string> = {
  es: "🇲🇽",
  ca: "🇪🇸",
  gl: "🇪🇸",
};

export function landingLanguageFlag(code: string): string {
  const label = BLOG_LANGS.find((item) => item.code === code)?.label ?? "";
  return FLAG_OVERRIDES[code] ?? label.match(/^\p{Regional_Indicator}{2}/u)?.[0] ?? "🇺🇳";
}

function countryCodeFromFlag(flag: string): string | null {
  const codePoints = Array.from(flag).map((character) => character.codePointAt(0) ?? 0);
  if (codePoints.length !== 2 || codePoints.some((code) => code < 0x1f1e6 || code > 0x1f1ff)) {
    return null;
  }
  return codePoints.map((code) => String.fromCharCode(code - 0x1f1e6 + 97)).join("");
}

export const LANDING_COUNTRY_LANGS = (() => {
  const seenCountries = new Set<string>();
  return BLOG_LANGS.filter((language) => {
    const countryCode = countryCodeFromFlag(landingLanguageFlag(language.code));
    if (!countryCode || seenCountries.has(countryCode)) return false;
    seenCountries.add(countryCode);
    return true;
  });
})();

const countryNames = new Map<string, Intl.DisplayNames>();

export function landingCountryName(languageCode: string, pageLanguage: string): string {
  const countryCode = countryCodeFromFlag(landingLanguageFlag(languageCode));
  if (!countryCode) return "";

  const locale = pageLanguage === "pt" ? "pt-BR" : pageLanguage;
  let names = countryNames.get(locale);
  if (!names) {
    names = new Intl.DisplayNames([locale], { type: "region" });
    countryNames.set(locale, names);
  }
  return names.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
}
