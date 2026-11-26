/**
 * Nome e descrição do item que aparecem no checkout, na fatura em PDF e no
 * e-mail do provedor de pagamento. Traduzido nos sete idiomas da interface,
 * sempre citando a matéria comprada.
 */
export type InvoiceLang = "pt" | "pt-PT" | "es" | "en" | "fr" | "it" | "de";

const ACCESS: Record<InvoiceLang, string> = {
  pt: "acesso por 1 ano",
  "pt-PT": "acesso por 1 ano",
  es: "acceso por 1 año",
  en: "1-year access",
  fr: "accès pendant 1 an",
  it: "accesso per 1 anno",
  de: "1 Jahr Zugang",
};

const RANGES: Record<InvoiceLang, Record<number, string>> = {
  pt: { 965: "até 1.000 cards", 1470: "1.001 a 2.000 cards", 1790: "mais de 2.000 cards" },
  "pt-PT": { 965: "até 1.000 cartões", 1470: "1.001 a 2.000 cartões", 1790: "mais de 2.000 cartões" },
  es: { 965: "hasta 1.000 tarjetas", 1470: "1.001 a 2.000 tarjetas", 1790: "más de 2.000 tarjetas" },
  en: { 965: "up to 1,000 cards", 1470: "1,001 to 2,000 cards", 1790: "over 2,000 cards" },
  fr: { 965: "jusqu'à 1 000 cartes", 1470: "1 001 à 2 000 cartes", 1790: "plus de 2 000 cartes" },
  it: { 965: "fino a 1.000 schede", 1470: "1.001 a 2.000 schede", 1790: "oltre 2.000 schede" },
  de: { 965: "bis 1.000 Karten", 1470: "1.001 bis 2.000 Karten", 1790: "über 2.000 Karten" },
};

const SUBJECT: Record<InvoiceLang, string> = {
  pt: "Matéria",
  "pt-PT": "Disciplina",
  es: "Materia",
  en: "Subject",
  fr: "Matière",
  it: "Materia",
  de: "Fach",
};

export function normalizeInvoiceLang(value: string | null | undefined): InvoiceLang {
  const v = (value ?? "en").toLowerCase();
  if (v === "pt-pt") return "pt-PT";
  if (v.startsWith("pt")) return "pt";
  if (v.startsWith("es")) return "es";
  if (v.startsWith("fr")) return "fr";
  if (v.startsWith("it")) return "it";
  if (v.startsWith("de")) return "de";
  return "en";
}

/** Ex.: "Flash Pilot — Inglês - Gramática (acesso por 1 ano)" */
export function invoiceItemName(lang: string | null | undefined, subjectName: string): string {
  const l = normalizeInvoiceLang(lang);
  const clean = (subjectName || SUBJECT[l]).trim().slice(0, 120);
  return `Flash Pilot — ${clean} (${ACCESS[l]})`;
}

/** Ex.: "Matéria — até 1.000 cards" */
export function invoiceItemDescription(lang: string | null | undefined, amountCents: number): string {
  const l = normalizeInvoiceLang(lang);
  const range = RANGES[l][amountCents];
  return range ? `${SUBJECT[l]} — ${range}` : SUBJECT[l];
}
