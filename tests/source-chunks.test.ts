import { describe, expect, it } from "vitest";
import { distributeCards, focusSourceRange, splitSourceChunks } from "@/lib/source-chunks";

describe("source chunks", () => {
  it("splits a 400k-char book into ordered chunks without losing text", () => {
    const text = Array.from({ length: 4000 }, (_, i) => `Parágrafo ${i} ` + "x".repeat(90)).join("\n\n");
    const chunks = splitSourceChunks(text, 60_000);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks[0].startsWith("Parágrafo 0 ")).toBe(true);
    expect(chunks.at(-1)!.includes("Parágrafo 3999")).toBe(true);
  });
  it("distributes requested cards across chunks", () => {
    expect(distributeCards(10, 3)).toEqual([4, 3, 3]);
  });
  it("narrows a code to the requested article range", () => {
    const law = "Intro\nArt. 1º Primeiro.\nArt. 2º Segundo.\nArt. 50. Cinquenta.\nArt. 51. Fora.";
    const out = focusSourceRange(law, "ART 1 ATE ART 50");
    expect(out).toContain("Cinquenta");
    expect(out).not.toContain("Fora");
  });
});
