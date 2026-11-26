type SourceNode = { order_index?: number | null; created_at?: string | null };
type SourceCard = SourceNode & {
  topic_id?: string;
  topics?: (SourceNode & { subject_id?: string; sourceAncestors?: SourceNode[] }) | null;
  microcontext?: (SourceNode & { id?: string }) | null;
};

function compareNode(a: SourceNode, b: SourceNode): number {
  const index = (a.order_index ?? Number.MAX_SAFE_INTEGER) - (b.order_index ?? Number.MAX_SAFE_INTEGER);
  if (index) return index;
  const timeA = a.created_at ? Date.parse(a.created_at) : 0;
  const timeB = b.created_at ? Date.parse(b.created_at) : 0;
  return timeA - timeB;
}

// Names never determine sequence. Stable sorting preserves input order for legacy ties.
export function sortBySourceOrder<T extends SourceCard>(cards: readonly T[]): T[] {
  const subjects = new Map<string, number>();
  for (const card of cards) {
    const id = card.topics?.subject_id ?? "";
    if (!subjects.has(id)) subjects.set(id, subjects.size);
  }
  return [...cards].sort((a, b) => {
    const subject = (subjects.get(a.topics?.subject_id ?? "") ?? 0) - (subjects.get(b.topics?.subject_id ?? "") ?? 0);
    if (subject) return subject;
    const pathA = [...(a.topics?.sourceAncestors ?? []), a.topics ?? {}];
    const pathB = [...(b.topics?.sourceAncestors ?? []), b.topics ?? {}];
    for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
      const nodeA = pathA[i];
      const nodeB = pathB[i];
      if (!nodeA || !nodeB) continue;
      const result = compareNode(nodeA, nodeB);
      if (result) return result;
    }
    return pathA.length - pathB.length ||
      compareNode(a.microcontext ?? {}, b.microcontext ?? {}) || compareNode(a, b);
  });
}

export function nextSourceIndex(rows: readonly SourceNode[]): number {
  return rows.reduce((max, row) => Math.max(max, row.order_index ?? 0), 0) + 1;
}