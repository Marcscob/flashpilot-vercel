// Fase 1 do Módulo de Idiomas: apenas a lista de idiomas suportados e rótulos.
// A decisão de idioma efetivo (card → matéria → pt-BR) é da Fase 2.

import { BLOG_LANGS } from "./blog-langs";

export const DEFAULT_LANGUAGE = "pt-BR";

export type SupportedLanguage = {
  code: string;
  label: string;
  flag: string;
};

// Rótulos no próprio idioma (endônimos), válidos em qualquer idioma da interface.
// Mapeia todo o catálogo de idiomas suportados no app (49 idiomas e variantes).
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = BLOG_LANGS.map((lang) => {
  const parts = lang.label.trim().split(/\s+/);
  const flag = parts[0]!;
  const rawLabel = parts.slice(1).join(" ");
  const code = lang.code === "pt" ? "pt-BR" : lang.code;
  const label = lang.code === "pt" ? "Português (Brasil)" : rawLabel;
  return { code, label, flag };
});

export function findLanguage(code?: string | null): SupportedLanguage | undefined {
  if (!code) return undefined;
  if (code === "pt") return SUPPORTED_LANGUAGES.find((l) => l.code === "pt-BR");
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

/** Only explicitly cataloged extra locales are propagated as content languages. */
export function validatedExtLanguage(code?: string | null): string | null {
  return findLanguage(code)?.code ?? null;
}

export function languageLabel(code?: string | null): string | undefined {
  const found = findLanguage(code);
  return found ? `${found.flag} ${found.label}` : (code ?? undefined);
}

/** Nome do idioma sem o emoji de bandeira (a bandeira vira <FlagIcon>). */
export function languageName(code?: string | null): string | undefined {
  const found = findLanguage(code);
  return found ? found.label : (code ?? undefined);
}

/** Emoji de bandeira do idioma (para converter em imagem via FlagIcon). */
export function languageFlag(code?: string | null): string | null {
  return findLanguage(code)?.flag ?? null;
}
