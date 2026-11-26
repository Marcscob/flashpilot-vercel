// Fase 2 do Módulo de Idiomas: única responsável por decidir o idioma efetivo.
// Regra: idioma do card → idioma da matéria → pt-BR (DEFAULT_LANGUAGE).
//
// IMPORTANTE (retrocompatibilidade): quando nem o card nem a matéria têm idioma
// definido, `hasExplicitLanguage` é false. Nesse caso as fases seguintes devem
// seguir exatamente o caminho atual do app (narração padrão, sem lógica
// multilíngue). O campo `language` continua sendo apenas informativo aqui.

import { DEFAULT_LANGUAGE, findLanguage } from "@/lib/languages";

export type CardLanguageSource = { language?: string | null } | null | undefined;
export type SubjectLanguageSource = { language?: string | null } | null | undefined;

export type ResolvedCardLanguage = {
  /** Idioma efetivo, sempre preenchido (cai em pt-BR quando nada foi definido). */
  language: string;
  /** De onde veio a decisão. */
  source: "card" | "subject" | "default";
  /** false = nada foi definido; manter o comportamento atual do app. */
  hasExplicitLanguage: boolean;
};

function normalize(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Aceita só idiomas conhecidos; qualquer valor estranho é tratado como ausente.
  return findLanguage(trimmed) ? trimmed : null;
}

export function resolveCardLanguage(
  card: CardLanguageSource,
  subject: SubjectLanguageSource,
): ResolvedCardLanguage {
  const fromCard = normalize(card?.language);
  if (fromCard) return { language: fromCard, source: "card", hasExplicitLanguage: true };

  const fromSubject = normalize(subject?.language);
  if (fromSubject) return { language: fromSubject, source: "subject", hasExplicitLanguage: true };

  return { language: DEFAULT_LANGUAGE, source: "default", hasExplicitLanguage: false };
}

/**
 * Conveniência para as fases seguintes: devolve o idioma a passar adiante ou
 * `undefined` quando nada foi definido — assim as funções existentes seguem o
 * caminho atual (sem `lang`).
 */
export function effectiveLanguageOrUndefined(
  card: CardLanguageSource,
  subject: SubjectLanguageSource,
): string | undefined {
  const resolved = resolveCardLanguage(card, subject);
  return resolved.hasExplicitLanguage ? resolved.language : undefined;
}
