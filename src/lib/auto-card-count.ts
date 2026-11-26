/** "PilotAI decide": cards per source block from its length (~1 card per 700 chars, 3–80 per block). */
export function autoCardCount(text: string, maxCards = 80): number {
  const len = text.trim().length;
  if (!len) return Math.min(10, maxCards);
  return Math.min(80, maxCards, Math.max(3, Math.round(len / 700)));
}

/** Estimate the entire prepared run, not the disabled quantity field. */
export function automaticCardCounts(chunks: string[], isPro: boolean): number[] {
  return chunks.map((chunk) => autoCardCount(chunk, isPro ? 80 : 40));
}

export function generationCostCheck(n: number, perCard: number, balance: number, isOwner: boolean) {
  const cost = n * perCard;
  const kind = isOwner ? null : balance < cost ? "low" : n >= 20 ? "confirm" : null;
  return { kind, n, cost, balance, perCard };
}
