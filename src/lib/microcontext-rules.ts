/** Regras puras (browser-safe) para agrupar cards em microcontextos. */
export type MicroGroup = { title: string; content: string; start: number; end: number };

/** Valida grupos do modelo: contíguos, em ordem, cobrindo 0..n-1 sem sobras. */
export function normalizeMicroGroups(raw: unknown, cardCount: number): MicroGroup[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: MicroGroup[] = [];
  let next = 0;
  for (const g of list) {
    if (next >= cardCount) break;
    const o = (g ?? {}) as Record<string, unknown>;
    const end = Math.min(cardCount - 1, Math.floor(Number(o.end)));
    const title = String(o.title ?? "").trim().slice(0, 200);
    const content = String(o.content ?? "").trim().slice(0, 4000);
    if (!Number.isFinite(end) || end < next || !title || !content) continue;
    out.push({ title, content, start: next, end });
    next = end + 1;
  }
  if (out.length && next < cardCount) out[out.length - 1].end = cardCount - 1;
  return out;
}
