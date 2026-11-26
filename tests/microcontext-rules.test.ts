import { describe, expect, it } from "vitest";
import { normalizeMicroGroups } from "@/lib/microcontext-rules";

describe("normalizeMicroGroups", () => {
  it("keeps contiguous groups and extends last to cover all cards", () => {
    const g = normalizeMicroGroups(
      [{ title: "A", content: "x", end: 2 }, { title: "B", content: "y", end: 4 }],
      7,
    );
    expect(g.map((x) => [x.start, x.end])).toEqual([[0, 2], [3, 6]]);
  });
  it("skips out-of-order or empty groups", () => {
    const g = normalizeMicroGroups(
      [{ title: "A", content: "x", end: 3 }, { title: "B", content: "y", end: 1 }, { title: "", content: "z", end: 5 }],
      5,
    );
    expect(g.map((x) => [x.start, x.end])).toEqual([[0, 4]]);
  });
});
