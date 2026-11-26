import { expect, test } from "bun:test";
import { findLanguage, validatedExtLanguage } from "../src/lib/languages";
import { effectiveLanguageOrUndefined, resolveCardLanguage } from "../src/lib/card-language";

test("all cataloged languages and variants are available for explicit subject/card languages", () => {
  for (const code of ["ja", "uk", "ar", "zh-CN", "ru", "de", "it", "es-AR", "es-ES", "pt-PT", "pt-BR"]) {
    expect(findLanguage(code)?.code).toBe(code);
    expect(validatedExtLanguage(code)).toBe(code);
  }

  expect(findLanguage("xx")).toBeUndefined();
  expect(validatedExtLanguage("xx")).toBeNull();
});

test("validated extension language keeps card-over-subject precedence and default fallback", () => {
  expect(resolveCardLanguage({ language: "ja" }, { language: "pt-BR" })).toEqual({
    language: "ja",
    source: "card",
    hasExplicitLanguage: true,
  });
  expect(effectiveLanguageOrUndefined(null, { language: "uk" })).toBe("uk");
  expect(effectiveLanguageOrUndefined(null, { language: "ru" })).toBe("ru");
  expect(effectiveLanguageOrUndefined(null, { language: "xx" })).toBeUndefined();
});
