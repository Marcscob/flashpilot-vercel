import { describe, it, expect } from "vitest";
import { autoCardCount, automaticCardCounts, generationCostCheck } from "../src/lib/auto-card-count";
describe("autoCardCount", () => {
  it("short text gets at least 3", () => expect(autoCardCount("a".repeat(100))).toBe(3));
  it("7000 chars gives 10", () => expect(autoCardCount("a".repeat(7000))).toBe(10));
  it("a full 60k block caps at 80", () => expect(autoCardCount("a".repeat(60000))).toBe(80));
  it("free users never exceed 40 on a 30k source", () => {
    expect(automaticCardCounts(["a".repeat(30000)], false)).toEqual([40]);
    expect(automaticCardCounts(["a".repeat(28350)], false)).toEqual([40]);
  });
  it("checks the total cost of all 60 subscriber blocks", () => {
    const counts = automaticCardCounts(Array.from({ length: 60 }, () => "a".repeat(60000)), true);
    expect(generationCostCheck(counts.reduce((a, b) => a + b, 0), 1, 5000, false))
      .toEqual({ kind: "confirm", n: 4800, cost: 4800, balance: 5000, perCard: 1 });
  });
  it("blocks an automatic run when the total exceeds the balance", () => {
    expect(generationCostCheck(160, 2, 319, false).kind).toBe("low");
  });
  it("keeps the owner exempt from spending prompts", () => {
    expect(generationCostCheck(4800, 1, 0, true).kind).toBeNull();
  });
  it("includes every web page in the automatic cost", () => {
    const n = ["a".repeat(30000), "b".repeat(30000)]
      .flatMap((text) => automaticCardCounts([text], false)).reduce((a, b) => a + b, 0);
    expect(generationCostCheck(n, 1, 79, false)).toMatchObject({ kind: "low", n: 80, cost: 80 });
  });
});
