import { describe, expect, it } from "vitest";
import { ledgerKind } from "../src/lib/ledger-labels";

describe("ledgerKind", () => {
  it("welcome kit is a bonus, not usage", () => {
    expect(ledgerKind("welcome_kit", "welcome:486c535a-88d8-40aa-9db0-89078740ffa7")).toBe("welcome");
  });
  it("saved flashcards map to flashcard creation", () => {
    expect(ledgerKind("ai_flashcards", "flashcards-save:5c87811c:91a5a8e5")).toBe("flashcards");
  });
  it("ai features map by cost id", () => {
    expect(ledgerKind("ai_feature", "ai-feature:mindmap:abc")).toBe("mindmap");
    expect(ledgerKind("ai_feature", "ai-feature:chat:abc")).toBe("chat");
  });
  it("subscription and refunds", () => {
    expect(ledgerKind("subscription", "sub:x")).toBe("subscription");
    expect(ledgerKind("refund", null)).toBe("refund");
  });
});
