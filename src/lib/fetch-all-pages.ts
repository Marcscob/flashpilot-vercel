/** Reads every row past the 1000-row API cap: ids in small groups (short URLs), pages of 1000. */
export async function fetchAllPages<T>(
  ids: string[],
  page: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  groupSize = 50,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let g = 0; g < ids.length; g += groupSize) {
    const group = ids.slice(g, g + groupSize);
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await page(group, from, from + pageSize - 1);
      if (error) throw error;
      out.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
    }
  }
  return out;
}
