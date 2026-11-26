import { T } from "./i18n-ui";
export type FlatTopic = {
  id: string;
  name: string;
  subject_id?: string | null;
  parent_id: string | null;
  order_index?: number | null;
  article_range?: string | null;
};

/** Nome de exibição: "Ação (arts. 15 a 29)" quando o campo de artigos está preenchido. */
export function topicDisplayName(t: { name: string; article_range?: string | null }): string {
  const ar = t.article_range?.trim();
  return ar ? `${t.name} (${ar})` : t.name;
}

export type TopicOption<T extends FlatTopic = FlatTopic> = T & {
  depth: number;
  /** Caminho completo: "Assunto › Subtópico › Subitem" */
  path: string;
};

/** Profundidade máxima renderizada/aceita (Matéria + 6 níveis). */
export const MAX_TOPIC_DEPTH = 6;

export const LEVEL_LABELS = ["Assunto", "Subtópico", "Subitem", "Nível 4", "Nível 5", "Nível 6"];

export function levelLabel(depth: number): string {
  const index = Math.max(0, Math.min(depth, LEVEL_LABELS.length - 1));
  return T(LEVEL_LABELS[index]!);
}

function byName(a: FlatTopic, b: FlatTopic) {
  const ao = a.order_index ?? null;
  const bo = b.order_index ?? null;
  if (ao !== null && bo !== null && ao !== bo) return ao - bo;
  if (ao !== null && bo === null) return -1;
  if (ao === null && bo !== null) return 1;
  return a.name.localeCompare(b.name, "pt-BR");
}

/**
 * Ordena tópicos em árvore (pai › filho › neto …) e devolve lista plana
 * com `depth` e `path`, para selects indentados de qualquer profundidade.
 */
export function flattenTopicTree<T extends FlatTopic>(topics: T[]): TopicOption<T>[] {
  const ids = new Set(topics.map((t) => t.id));
  const byParent = new Map<string | null, T[]>();
  for (const t of topics) {
    const key = t.parent_id && ids.has(t.parent_id) ? t.parent_id : null;
    const arr = byParent.get(key) ?? [];
    arr.push(t);
    byParent.set(key, arr);
  }
  for (const arr of byParent.values()) arr.sort(byName);

  const out: TopicOption<T>[] = [];
  const walk = (parent: string | null, depth: number, prefix: string) => {
    if (depth > MAX_TOPIC_DEPTH) return;
    for (const t of byParent.get(parent) ?? []) {
      const label = topicDisplayName(t);
      const path = prefix ? `${prefix} › ${label}` : label;
      out.push({ ...t, depth, path });
      walk(t.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return out;
}

export function indentTopicLabel(o: {
  depth: number;
  name: string;
  article_range?: string | null;
}): string {
  return `${"\u00A0\u00A0".repeat(o.depth)}${o.depth > 0 ? "› " : ""}${topicDisplayName(o)}`;
}

/** Conjunto com o próprio id e todos os descendentes. */
export function descendantsOf(topics: FlatTopic[], rootId: string): Set<string> {
  const set = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of topics) {
      if (t.parent_id && set.has(t.parent_id) && !set.has(t.id)) {
        set.add(t.id);
        changed = true;
      }
    }
  }
  return set;
}

export function isDescendant(topics: FlatTopic[], rootId: string, candidateId: string): boolean {
  return descendantsOf(topics, rootId).has(candidateId);
}

/** Caminho "Assunto › Subtópico › Subitem" a partir de um mapa id → tópico. */
export function pathOf(
  map: Map<string, FlatTopic>,
  topicId: string | null | undefined,
  sep = " › ",
): string {
  if (!topicId) return "";
  const parts: string[] = [];
  let cur = map.get(topicId);
  let guard = 0;
  while (cur && guard++ <= MAX_TOPIC_DEPTH + 2) {
    parts.unshift(topicDisplayName(cur));
    cur = cur.parent_id ? map.get(cur.parent_id) : undefined;
  }
  return parts.join(sep);
}

/** Profundidade do tópico (0 = assunto raiz). */
export function depthOf(map: Map<string, FlatTopic>, topicId: string | null | undefined): number {
  let d = 0;
  let cur = topicId ? map.get(topicId) : undefined;
  let guard = 0;
  while (cur?.parent_id && guard++ <= MAX_TOPIC_DEPTH + 2) {
    d += 1;
    cur = map.get(cur.parent_id);
  }
  return d;
}
