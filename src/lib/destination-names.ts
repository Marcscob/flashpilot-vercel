/** Nomes de matéria e assunto: regras puras, usadas no servidor e testadas sem rede. */

const GENERIC_NAME_PATTERNS: RegExp[] = [
  /^(mat[eé]ria|assunto|subject|topic|materia|sujet|thema|argomento|tema)\s+demo\b/i,
  /^demo\b/i,
  /^(decreta|promulga|resolve|determina|ordena|fa[cç]o\s+saber|considerando)\s*[:.]?$/i,
  /flashcards?\s+inteligentes?/i,
  /smart\s+flashcards?/i,
  /pilot\s?ai|flashpilot/i,
  /^(resultado|result)\s+(do|of)\s+(seu|your)\s+(teste|test)/i,
  /^(flashcards?|cards?|material|materiais|teste|test|estudos?|study|geral|general|untitled|sem\s+t[ií]tulo|novo|new)$/i,
];

export type DestinationNames = { subject: string; topic: string };

export function cleanName(value: unknown, max = 100): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/^["'“”‘’«»]+|["'“”‘’«».:]+$/g, "")
    .trim()
    .slice(0, max);
}

export function isGenericName(value: unknown): boolean {
  const name = cleanName(value);
  return !name || GENERIC_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

const LAST_RESORT_SUBJECT: Record<string, string> = {
  pt: "Estudos",
  "pt-PT": "Estudos",
  en: "Study",
  es: "Estudios",
  fr: "Études",
  it: "Studio",
  de: "Lernen",
};

/** Último recurso, só se a IA de nomes também falhar: assunto vem da primeira pergunta. */
export function fallbackNamesFromCards(
  cards: ReadonlyArray<{ question: string }>,
  lang: string,
): DestinationNames {
  const base = lang.split("-")[0] ?? "pt";
  const subject = LAST_RESORT_SUBJECT[lang] ?? LAST_RESORT_SUBJECT[base] ?? "Study";
  const first = cleanName((cards[0]?.question ?? "").replace(/[?？]+$/g, ""), 60);
  return { subject, topic: first || subject };
}

/** Mantém o nome que já presta e diz qual campo ainda precisa ser descoberto. */
export function pickUsableNames(subject: unknown, topic: unknown) {
  const cleanSubject = isGenericName(subject) ? "" : cleanName(subject);
  const cleanTopic = isGenericName(topic) ? "" : cleanName(topic);
  return {
    subject: cleanSubject,
    topic: cleanTopic,
    complete: Boolean(cleanSubject && cleanTopic),
  };
}
