import { describe, test, expect } from "bun:test";
import { LANDING_LIMITS, LANDING_ECONOMY } from "../src/lib/landing-rules";
import { landingHead } from "../src/lib/landing-head";
import { ALL_LANGS } from "../src/lib/lang-match";
import { sheetToCards } from "../src/lib/sheet-import";
describe("public landing rules", () => {
  test("generation demonstration is capped at ten cards", () =>
    expect(LANDING_LIMITS.cards).toBe(10));
  test("main text field allows up to 15,000 characters", () =>
    expect(LANDING_LIMITS.textFieldChars).toBe(15_000));
  test("welcome coins are forty", () => expect(LANDING_ECONOMY.welcome).toBe(40));
  test("monthly renewal grants 150 coins", () => expect(LANDING_ECONOMY.monthly).toBe(150));
  test("yearly renewal grants 300 coins", () => expect(LANDING_ECONOMY.yearly).toBe(300));
  test("purchased coins have twelve-month terms", () =>
    expect(LANDING_ECONOMY.validityMonths).toBe(12));
  test("structured sheets retain HTML and do not acquire generation billing ids", () => {
    const cards = sheetToCards({
      name: "sample.csv",
      cols: 2,
      rows: [
        ["Question", "Answer"],
        ["What?", "<em>A formatted answer</em>"],
      ],
    });
    expect(cards).toEqual([{ question: "What?", answer: "<em>A formatted answer</em>" }]);
  });
  test("language variants self-reference and alternates only cover shipped languages", () => {
    for (const lang of ALL_LANGS) {
      const head = landingHead(lang, true);
      expect(head.links.find((l) => l.rel === "canonical")?.href).toBe(
        `https://flashpilot.net/?lang=${lang}`,
      );
      expect(head.links.filter((l) => l.rel === "alternate")).toHaveLength(ALL_LANGS.length + 1);
    }
  });
});
