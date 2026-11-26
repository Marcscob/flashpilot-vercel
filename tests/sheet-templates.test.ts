import { describe, expect, test } from "bun:test";
import { sheetTemplateForLanguage } from "../src/lib/sheet-templates";

describe("Bulk v2 localized workbook selection", () => {
  for (const lang of ["pt", "pt-PT", "en", "es", "fr", "it", "de"]) {
    test(`${lang} downloads its own workbook`, () => {
      const template = sheetTemplateForLanguage(lang);
      expect(template.filename).toBe(`flashpilot-template-${lang}.xlsx`);
      expect(template.url.endsWith(`/flashpilot-template-${lang}.xlsx`)).toBe(true);
    });
  }
  test("extra locales receive generated workbooks instead of English fallback", () => {
    expect(sheetTemplateForLanguage("ja")).toEqual({
      url: null,
      filename: "flashpilot-ja.xlsx",
    });
  });
});
