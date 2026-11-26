import { describe, expect, it } from "vitest";
import { structureSourceText } from "../src/lib/card-format";

describe("structureSourceText", () => {
  it("puts each inciso on its own line", () => {
    const out = structureSourceText("Serão registrados: I - os nascimentos; II - a emancipação; III - a interdição.");
    expect(out.split("\n")).toEqual([
      "Serão registrados:",
      "Inciso I: os nascimentos;",
      "Inciso II: a emancipação;",
      "Inciso III: a interdição.",
    ]);
  });

  it("breaks paragraphs onto new lines", () => {
    expect(structureSourceText("Caput. § 1º Primeiro. Parágrafo único. Outro.").split("\n")).toEqual([
      "Caput.",
      "§ 1º Primeiro.",
      "Parágrafo único. Outro.",
    ]);
  });
});
