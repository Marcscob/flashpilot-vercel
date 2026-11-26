import { z } from "zod";

export const MATCH_ROUND_MAX = 5;
export const MATCH_ROUND_MIN = 3;
export const MATCH_MAX_ROUNDS = 12;
export const MATCH_LEFT_MAX_CHARS = 80;
export const MATCH_RIGHT_MAX_CHARS = 160;

export type MatchPair = { left: string; right: string };
export type MatchRound = { pairs: MatchPair[] };
export type MatchGameDraft = { title: string; language: string | null; rounds: MatchRound[] };

const stripMarkdown = (text: string) =>
  text
    .replace(/\*\*|__|`+/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\p{M}\p{P}\p{S}\s]+/gu, "");

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Limpa, limita e remove pares vazios, iguais entre si ou com texto repetido. */
export function normalizePairs(raw: unknown): MatchPair[] {
  if (!Array.isArray(raw)) return [];
  const seenLeft = new Set<string>();
  const seenRight = new Set<string>();
  const out: MatchPair[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { left, right } = item as { left?: unknown; right?: unknown };
    if (typeof left !== "string" || typeof right !== "string") continue;
    const l = clip(stripMarkdown(left), MATCH_LEFT_MAX_CHARS);
    const r = clip(stripMarkdown(right), MATCH_RIGHT_MAX_CHARS);
    const fl = fold(l);
    const fr = fold(r);
    if (!fl || !fr || fl === fr || seenLeft.has(fl) || seenRight.has(fr)) continue;
    seenLeft.add(fl);
    seenRight.add(fr);
    out.push({ left: l, right: r });
  }
  return out;
}

/** Divide em rodadas equilibradas de 3 a 5 pares, mantendo a ordem da fonte. */
export function chunkIntoRounds(pairs: MatchPair[]): MatchRound[] {
  const total = Math.min(pairs.length, MATCH_ROUND_MAX * MATCH_MAX_ROUNDS);
  if (total < MATCH_ROUND_MIN) return [];
  const rounds = Math.ceil(total / MATCH_ROUND_MAX);
  const base = Math.floor(total / rounds);
  const extra = total % rounds;
  const out: MatchRound[] = [];
  let cursor = 0;
  for (let i = 0; i < rounds; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push({ pairs: pairs.slice(cursor, cursor + size) });
    cursor += size;
  }
  return out;
}

/** Quantos pares pedir à IA no máximo: um por card, entre 3 e 30 (poucos cards geram pares repetidos). */
export function targetPairCount(cardCount: number): number {
  return Math.max(MATCH_ROUND_MIN, Math.min(30, cardCount));
}

function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Ordem embaralhada e estável da coluna da direita; nunca idêntica à original. */
export function shuffledOrder(length: number, seed: number): number[] {
  const order = Array.from({ length }, (_, i) => i);
  if (length < 2) return order;
  const random = seededRandom(seed);
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    if (order.some((value, index) => value !== index)) return order;
  }
  return [...order.slice(1), order[0]!];
}

export const matchRoundSchema = z.object({
  pairs: z
    .array(
      z.object({
        left: z.string().trim().min(1).max(200),
        right: z.string().trim().min(1).max(400),
      }),
    )
    .min(MATCH_ROUND_MIN)
    .max(MATCH_ROUND_MAX),
});

export const matchDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  language: z.string().max(20).nullable().optional(),
  rounds: z.array(matchRoundSchema).min(1).max(MATCH_MAX_ROUNDS),
});
