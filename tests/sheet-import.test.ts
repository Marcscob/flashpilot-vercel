import { expect, test } from "bun:test";
import { sheetToCards, type SheetData } from "../src/lib/sheet-import";

const translatedTemplate: SheetData = {
  name: "flashpilot-ja.xlsx",
  rows: [
    ["質問", "回答"],
    ["Capital of France?", "Paris"],
  ],
  cols: 2,
};

test("removes translated template headers before importing cards", () => {
  expect(sheetToCards(translatedTemplate, { q: "質問", a: "回答" })).toEqual([
    { question: "Capital of France?", answer: "Paris" },
  ]);
});

test("preserves existing recognized spreadsheet headers", () => {
  expect(
    sheetToCards({
      ...translatedTemplate,
      rows: [
        ["Question", "Answer"],
        ["Q", "A"],
      ],
    }),
  ).toEqual([{ question: "Q", answer: "A" }]);
});
