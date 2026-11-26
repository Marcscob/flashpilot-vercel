import { describe, test, expect } from "bun:test";
import { matchBrowserLang, matchAcceptLanguage, FALLBACK_LANG } from "../src/lib/lang-match";

describe("browser language matching uses only the primary preference", () => {
  test("unsupported primary falls back to English even with Portuguese system tags", () =>
    expect(matchBrowserLang(["ru-RU", "ru", "pt-BR", "pt"])).toBeNull());
  test("Turkish primary with Portuguese secondary falls back to English", () =>
    expect(matchBrowserLang(["tr-TR", "tr", "pt-BR", "pt"])).toBeNull());
  test("Japanese primary with Portuguese secondary falls back to English", () =>
    expect(matchBrowserLang(["ja-JP", "ja", "pt-BR"])).toBeNull());
  test("Portuguese primary stays Brazilian Portuguese even with other tags", () =>
    expect(matchBrowserLang(["pt-BR", "ru", "ru-RU"])).toBe("pt"));
  test("European regions map to the European variant", () =>
    expect(matchBrowserLang(["pt-PT", "en"])).toBe("pt-PT"));
  test("English primary resolves to English", () =>
    expect(matchBrowserLang(["en-US", "en"])).toBe("en"));
  test("empty list falls back to English via the helper", () =>
    expect(matchAcceptLanguage(undefined)).toBe(FALLBACK_LANG));
  test("Accept-Language with unsupported primary and Portuguese secondary yields English", () =>
    expect(matchAcceptLanguage("ru-RU,ru;q=0.9,pt-BR;q=0.8,pt;q=0.7")).toBe("en"));
  test("Accept-Language with Portuguese primary yields Brazilian Portuguese", () =>
    expect(matchAcceptLanguage("pt-BR,pt;q=0.9,ru;q=0.5")).toBe("pt"));
  test("Accept-Language with Portuguese European primary yields the European variant", () =>
    expect(matchAcceptLanguage("pt-PT,pt;q=0.9")).toBe("pt-PT"));
});
