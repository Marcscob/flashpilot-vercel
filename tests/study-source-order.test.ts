import { describe, expect, test as it } from "bun:test";
import { nextSourceIndex, sortBySourceOrder } from "../src/lib/study-source-order";

describe("source order in review", () => {
  it("keeps Art. 1 before Art. 36 regardless of alphabetical topic names", () => {
    const cards = [
      { id: "36", topics: { name: "Da Transferência", order_index: 5 } },
      { id: "1", topics: { name: "Disposições Preliminares", order_index: 1 } },
    ];
    expect(sortBySourceOrder(cards).map(c => c.id)).toEqual(["1", "36"]);
  });
  it("compares parents before their locally numbered children and blocks", () => {
    const cards = [
      { id: "later", topics: { order_index: 1, sourceAncestors: [{ order_index: 2 }] }, microcontext: { order_index: 1 } },
      { id: "first", topics: { order_index: 2, sourceAncestors: [{ order_index: 1 }] }, microcontext: { order_index: 3 } },
    ];
    expect(sortBySourceOrder(cards).map(c => c.id)).toEqual(["first", "later"]);
  });
  it("orders cards inside each block and retains input without mutating it", () => {
    const cards = [
      { id: "3", order_index: 3, microcontext: { order_index: 2 } },
      { id: "2", order_index: 2, microcontext: { order_index: 1 } },
      { id: "1", order_index: 1, microcontext: { order_index: 1 } },
    ];
    expect(sortBySourceOrder(cards).map(c => c.id)).toEqual(["1", "2", "3"]);
    expect(cards.map(c => c.id)).toEqual(["3", "2", "1"]);
  });
  it("uses creation sequence for legacy topics without indexes", () => {
    const cards = [
      { id: "later", topics: { created_at: "2026-11-25T02:00:00Z" } },
      { id: "first", topics: { created_at: "2026-11-25T01:00:00Z" } },
    ];
    expect(sortBySourceOrder(cards).map(c => c.id)).toEqual(["first", "later"]);
  });
  it("appends new destinations after existing sequence", () => {
    expect(nextSourceIndex([{ order_index: 1 }, { order_index: 8 }, { order_index: null }])).toBe(9);
    expect(nextSourceIndex([])).toBe(1);
  });
  it("orders the flashcard list and exports by source topic then card, without question sorting", () => {
    const cards = [
      { id: "46", question: "A segurança", order_index: 1, topics: { subject_id: "lgpd", name: "Da Segurança", order_index: 6 } },
      { id: "2", question: "A aplicação", order_index: 2, topics: { subject_id: "lgpd", name: "Disposições Preliminares", order_index: 1 } },
      { id: "1", question: "Z objetivo", order_index: 1, topics: { subject_id: "lgpd", name: "Disposições Preliminares", order_index: 1 } },
    ];
    expect(sortBySourceOrder(cards).map(c => c.id)).toEqual(["1", "2", "46"]);
  });
});