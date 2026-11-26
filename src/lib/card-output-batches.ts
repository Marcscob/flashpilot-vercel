import { parseJsonLenient } from "./json-repair";

export const CARD_OUTPUT_TOKENS = 8192;
export const CARDS_PER_OUTPUT_BATCH = 8;

/** Split source and requested quantity together, retaining their original order. */
export function planCardOutputBatches(text: string, count: number): Array<{ text: string; count: number }> {
  if (!Number.isInteger(count) || count < 1) throw new Error("Invalid card count");
  const total = Math.max(Math.ceil(count / CARDS_PER_OUTPUT_BATCH), Math.ceil(text.length / 18_000));
  const batches = Math.min(count, total);
  const out: Array<{ text: string; count: number }> = [];
  let start = 0;
  for (let index = 0; index < batches; index++) {
    const idealEnd = Math.round(text.length * (index + 1) / batches);
    let end = idealEnd;
    if (index < batches - 1) {
      const paragraph = text.lastIndexOf("\n\n", idealEnd);
      const sentence = text.lastIndexOf(". ", idealEnd);
      const boundary = paragraph > start ? paragraph + 2 : sentence > start ? sentence + 2 : idealEnd;
      if (boundary - start >= (idealEnd - start) * 0.5) end = boundary;
    } else end = text.length;
    out.push({ text: text.slice(start, end), count: Math.floor(count / batches) + (index < count % batches ? 1 : 0) });
    start = end;
  }
  return out;
}

/** Keep only fully closed card objects; never repair an unfinished answer. */
export function completeCardsFromTruncatedJson(raw: string): string {
  const match = /"cards"\s*:\s*\[/.exec(raw);
  if (!match) return '{"cards":[]}';
  const cards: unknown[] = [];
  let depth = 0, start = -1, quoted = false, escaped = false;
  for (let index = match.index + match[0].length; index < raw.length; index++) {
    const char = raw[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{") { if (depth === 0) start = index; depth++; }
    else if (char === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const card = parseJsonLenient(raw.slice(start, index + 1));
        if (card && typeof card === "object") cards.push(card);
      }
    } else if (char === "]" && depth === 0) break;
  }
  return JSON.stringify({ cards });
}

type BatchCard = { question: string; answer: string };

/** A shortened continuation is a repaired request, not a retry of a failed provider call. */
export async function recoverCardOutput<T extends BatchCard>(
  count: number,
  generate: (count: number, previous: T[]) => Promise<{ cards: T[]; truncated: boolean }>,
  previous: T[] = [],
  depth = 0,
): Promise<T[]> {
  const result = await generate(count, previous);
  const seen = new Set(previous.map(card => card.question.trim().toLowerCase()));
  const accepted = result.cards.filter(card => {
    const key = card.question.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, count);
  if (!result.truncated || accepted.length === count) return accepted;
  if (depth >= 4) throw new Error("Não foi possível concluir a geração. Tente novamente mais tarde.");
  const remaining = count - accepted.length;
  const smaller = Math.max(1, Math.ceil(remaining / 2));
  const out = [...accepted];
  for (let left = remaining; left > 0; left -= smaller) {
    out.push(...await recoverCardOutput(Math.min(left, smaller), generate, [...previous, ...out], depth + 1));
  }
  return out;
}