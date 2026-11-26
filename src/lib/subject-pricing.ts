/**
 * Faixas de preço das matérias na Loja, definidas pelo número de cards.
 * até 1.000 → US$ 9,65 · 1.001 a 2.000 → US$ 14,70 · acima de 2.000 → US$ 17,90
 */
export type SubjectTier = {
  cents: number;
  paddlePriceId: string;
  label: string;
  rangeLabel: string;
};

export const SUBJECT_TIERS: SubjectTier[] = [
  { cents: 965, paddlePriceId: "subject_tier_965", label: "US$ 9,65", rangeLabel: "até 1.000 cards" },
  { cents: 1470, paddlePriceId: "subject_tier_1470", label: "US$ 14,70", rangeLabel: "1.001 a 2.000 cards" },
  { cents: 1790, paddlePriceId: "subject_tier_1790", label: "US$ 17,90", rangeLabel: "acima de 2.000 cards" },
];

/** Ids de preço gerenciados automaticamente (podem ser sobrescritos pelo painel). */
export const MANAGED_PADDLE_PRICE_IDS = new Set<string>([
  ...SUBJECT_TIERS.map((t) => t.paddlePriceId),
  "module_purchase",
  "module_avulso",
]);

export function formatUsd(cents: number) {
  return `US$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function tierFor(cardCount: number): SubjectTier {
  if (cardCount > 2000) return SUBJECT_TIERS[2]!;
  if (cardCount > 1000) return SUBJECT_TIERS[1]!;
  return SUBJECT_TIERS[0]!;
}
