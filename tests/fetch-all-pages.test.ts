import { describe, expect, it } from "vitest";
import { fetchAllPages } from "@/lib/fetch-all-pages";

describe("fetchAllPages", () => {
  it("loads 1200 cards past the 1000-row cap", async () => {
    const rows = Array.from({ length: 1200 }, (_, i) => ({ i }));
    const all = await fetchAllPages(["t1"], async (_ids, from, to) => ({ data: rows.slice(from, to + 1), error: null }));
    expect(all).toHaveLength(1200);
  });
  it("splits 120 topics into groups of 50", async () => {
    const sizes: number[] = [];
    await fetchAllPages(Array.from({ length: 120 }, (_, i) => `t${i}`), async (ids) => { sizes.push(ids.length); return { data: [], error: null }; });
    expect(sizes).toEqual([50, 50, 20]);
  });
});
