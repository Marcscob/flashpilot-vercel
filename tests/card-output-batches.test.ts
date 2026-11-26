import { describe, it, expect } from "bun:test";
import { planCardOutputBatches, completeCardsFromTruncatedJson, recoverCardOutput } from "../src/lib/card-output-batches";

describe("Document output capacity", () => {
  it("processes the entire 29763-character source and all 42 requested cards in order", () => {
    const text = "Artigo.\n\n".repeat(4000).slice(0, 29763);
    const batches = planCardOutputBatches(text, 42);
    expect(batches.map(batch => batch.text).join("")).toBe(text);
    expect(batches.reduce((sum, batch) => sum + batch.count, 0)).toBe(42);
    expect(batches.every(batch => batch.count <= 8)).toBe(true);
  });
  it("never manufactures an unfinished answer when output is truncated", () => {
    const raw = '{"cards":[{"question":"Q {one}","answer":"Complete"},{"question":"Q2","answer":"unfinished';
    expect(JSON.parse(completeCardsFromTruncatedJson(raw))).toEqual({ cards: [{ question: "Q {one}", answer: "Complete" }] });
  });
  it("keeps completed cards and repairs only the missing output using smaller requests", async () => {
    const calls: number[] = [];
    const cards = await recoverCardOutput(8, async (count, previous) => {
      calls.push(count);
      const size = calls.length === 1 ? 2 : count;
      return { cards: Array.from({ length: size }, (_, index) => ({ question: `Q${previous.length + index + 1}`, answer: "A" })), truncated: calls.length === 1 };
    });
    expect(cards.map(card => card.question)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"]);
    expect(calls).toEqual([8, 3, 3]);
  });
  it("does not retry provider denials or other failed requests", async () => {
    let calls = 0;
    await expect(recoverCardOutput(8, async () => { calls++; throw new Error("Denied"); })).rejects.toThrow("Denied");
    expect(calls).toBe(1);
  });
  it("does not retry a successful shorter selection of eligible material", async () => {
    let calls = 0;
    const cards = await recoverCardOutput(8, async () => { calls++; return { cards: [{ question: "Q", answer: "A" }], truncated: false }; });
    expect(cards).toHaveLength(1);
    expect(calls).toBe(1);
  });
});