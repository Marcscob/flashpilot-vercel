/**
 * Países usados no telefone (prefixo internacional) e no filtro da Loja.
 * O nome é resolvido com Intl.DisplayNames no idioma da interface, então
 * aqui guardamos apenas código ISO2, prefixo, bandeira e idioma principal.
 */
import type { Lang } from "./lang-match";

export type Country = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** Prefixo internacional, sem o "+" */
  dial: string;
  flag: string;
  /** Idioma da interface/matérias associado ao país */
  lang: Lang;
};

export const COUNTRIES: Country[] = [
  { code: "BR", dial: "55", flag: "🇧🇷", lang: "pt" },
  { code: "PT", dial: "351", flag: "🇵🇹", lang: "pt-PT" },
  { code: "AO", dial: "244", flag: "🇦🇴", lang: "pt-PT" },
  { code: "MZ", dial: "258", flag: "🇲🇿", lang: "pt-PT" },
  { code: "CV", dial: "238", flag: "🇨🇻", lang: "pt-PT" },
  { code: "US", dial: "1", flag: "🇺🇸", lang: "en" },
  { code: "GB", dial: "44", flag: "🇬🇧", lang: "en" },
  { code: "CA", dial: "1", flag: "🇨🇦", lang: "en" },
  { code: "IE", dial: "353", flag: "🇮🇪", lang: "en" },
  { code: "AU", dial: "61", flag: "🇦🇺", lang: "en" },
  { code: "NZ", dial: "64", flag: "🇳🇿", lang: "en" },
  { code: "ZA", dial: "27", flag: "🇿🇦", lang: "en" },
  { code: "IN", dial: "91", flag: "🇮🇳", lang: "en" },
  { code: "ES", dial: "34", flag: "🇪🇸", lang: "es" },
  { code: "MX", dial: "52", flag: "🇲🇽", lang: "es" },
  { code: "AR", dial: "54", flag: "🇦🇷", lang: "es" },
  { code: "CL", dial: "56", flag: "🇨🇱", lang: "es" },
  { code: "CO", dial: "57", flag: "🇨🇴", lang: "es" },
  { code: "PE", dial: "51", flag: "🇵🇪", lang: "es" },
  { code: "UY", dial: "598", flag: "🇺🇾", lang: "es" },
  { code: "PY", dial: "595", flag: "🇵🇾", lang: "es" },
  { code: "BO", dial: "591", flag: "🇧🇴", lang: "es" },
  { code: "EC", dial: "593", flag: "🇪🇨", lang: "es" },
  { code: "VE", dial: "58", flag: "🇻🇪", lang: "es" },
  { code: "CR", dial: "506", flag: "🇨🇷", lang: "es" },
  { code: "PA", dial: "507", flag: "🇵🇦", lang: "es" },
  { code: "DO", dial: "1", flag: "🇩🇴", lang: "es" },
  { code: "GT", dial: "502", flag: "🇬🇹", lang: "es" },
  { code: "FR", dial: "33", flag: "🇫🇷", lang: "fr" },
  { code: "BE", dial: "32", flag: "🇧🇪", lang: "fr" },
  { code: "LU", dial: "352", flag: "🇱🇺", lang: "fr" },
  { code: "SN", dial: "221", flag: "🇸🇳", lang: "fr" },
  { code: "CI", dial: "225", flag: "🇨🇮", lang: "fr" },
  { code: "MA", dial: "212", flag: "🇲🇦", lang: "fr" },
  { code: "IT", dial: "39", flag: "🇮🇹", lang: "it" },
  { code: "CH", dial: "41", flag: "🇨🇭", lang: "de" },
  { code: "DE", dial: "49", flag: "🇩🇪", lang: "de" },
  { code: "AT", dial: "43", flag: "🇦🇹", lang: "de" },
  { code: "JP", dial: "81", flag: "🇯🇵", lang: "en" },
  { code: "CN", dial: "86", flag: "🇨🇳", lang: "en" },
  { code: "NL", dial: "31", flag: "🇳🇱", lang: "en" },
  { code: "SE", dial: "46", flag: "🇸🇪", lang: "en" },
  { code: "NO", dial: "47", flag: "🇳🇴", lang: "en" },
  { code: "DK", dial: "45", flag: "🇩🇰", lang: "en" },
  { code: "PL", dial: "48", flag: "🇵🇱", lang: "en" },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(code: string | null | undefined): Country | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

/** País padrão sugerido para cada idioma da interface. */
export function defaultCountryForLang(lang: Lang): string {
  switch (lang) {
    case "pt":
      return "BR";
    case "pt-PT":
      return "PT";
    case "es":
      return "ES";
    case "fr":
      return "FR";
    case "it":
      return "IT";
    case "de":
      return "DE";
    default:
      return "US";
  }
}

/** Nome do país no idioma da interface (cai no código se o navegador não souber). */
export function countryName(code: string, lang: Lang): string {
  try {
    const dn = new Intl.DisplayNames([lang === "pt" ? "pt-BR" : lang], { type: "region" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Lista ordenada alfabeticamente no idioma atual. */
export function sortedCountries(lang: Lang): (Country & { name: string })[] {
  return COUNTRIES.map((c) => ({ ...c, name: countryName(c.code, lang) })).sort((a, b) =>
    a.name.localeCompare(b.name, lang === "pt" ? "pt-BR" : lang),
  );
}

/** Divide um telefone E.164 no prefixo conhecido + restante. */
export function splitPhone(phone: string | null | undefined): { country?: string; local: string } {
  if (!phone) return { local: "" };
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) return { local: digits };
  const bare = digits.slice(1);
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => bare.startsWith(c.dial));
  if (!match) return { local: bare };
  return { country: match.code, local: bare.slice(match.dial.length) };
}
