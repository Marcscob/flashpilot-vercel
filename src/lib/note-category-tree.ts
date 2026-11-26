export type FlatCat = {
  id: string;
  name: string;
  parent_id: string | null;
  subject_id?: string | null;
  topic_id?: string | null;
};

export type CatOption = FlatCat & { depth: number; path: string };

/**
 * Ordena as categorias em árvore (pai › filho › neto) e devolve uma lista
 * plana com profundidade, para renderizar Selects indentados incluindo
 * assuntos e subtópicos.
 */
export function flattenCategoryTree(cats: FlatCat[]): CatOption[] {
  const byParent = new Map<string | null, FlatCat[]>();
  const ids = new Set(cats.map((c) => c.id));
  for (const c of cats) {
    // categorias órfãs (pai inexistente) viram raiz para não sumirem da lista
    const key = c.parent_id && ids.has(c.parent_id) ? c.parent_id : null;
    const arr = byParent.get(key) ?? [];
    arr.push(c);
    byParent.set(key, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  const out: CatOption[] = [];
  const walk = (parent: string | null, depth: number, prefix: string) => {
    for (const c of byParent.get(parent) ?? []) {
      const path = prefix ? `${prefix} › ${c.name}` : c.name;
      out.push({ ...c, depth, path });
      if (depth < 6) walk(c.id, depth + 1, path);
    }
  };
  walk(null, 0, "");
  return out;
}

export function indentLabel(o: CatOption): string {
  return `${"\u00A0\u00A0".repeat(o.depth)}${o.depth > 0 ? "› " : ""}${o.name}`;
}
