import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { STANDARD_LANGUAGE_RULES, sharedCardGuidelines } from "../src/lib/card-guidelines";

describe("norma culta em qualquer fonte", () => {
  it("vale para toda geração de cards", () => {
    expect(sharedCardGuidelines({ requestedCards: 5, destination: false })).toContain(STANDARD_LANGUAGE_RULES);
  });
  it("vale para os microcontexts", () => {
    expect(readFileSync("src/lib/microcontexts.functions.ts", "utf8")).toContain("${STANDARD_LANGUAGE_RULES}");
  });
});
