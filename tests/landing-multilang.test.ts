import { describe, expect, it } from "bun:test";
import { BLOG_LANGS } from "@/lib/blog-langs";
import {
  isSupportedAppLang,
  resolveRequestedAppLocale,
  matchAppLocale,
  nativeFor,
  isExtLang,
} from "@/lib/app-ext-langs";
import {
  landingLanguageTitle,
  LANDING_LANGUAGE_TITLE_CODES,
} from "@/lib/landing-language-title";

describe("Detecção e resolução dos 52 idiomas na Homepage", () => {
  it("deve cobrir exatamente os 52 idiomas e variantes do app", () => {
    expect(BLOG_LANGS).toHaveLength(52);

    for (const item of BLOG_LANGS) {
      expect(isSupportedAppLang(item.code)).toBe(true);
      const resolved = resolveRequestedAppLocale(item.code);
      expect(resolved).not.toBeNull();

      const native = nativeFor(item.code);
      if (native) {
        expect(resolved?.lang).toBe(native);
        expect(resolved?.extLang).toBeNull();
      } else {
        expect(isExtLang(item.code)).toBe(true);
        expect(resolved?.lang).toBe("en");
        expect(resolved?.extLang).toBe(item.code);
      }
    }
  });

  it("deve ter um título localizado para cada um dos 52 idiomas e variantes", () => {
    expect(LANDING_LANGUAGE_TITLE_CODES).toHaveLength(BLOG_LANGS.length);
    expect([...LANDING_LANGUAGE_TITLE_CODES].sort()).toEqual(
      BLOG_LANGS.map(({ code }) => code).sort(),
    );
    for (const { code } of BLOG_LANGS) {
      expect(landingLanguageTitle(code).trim().length).toBeGreaterThan(0);
    }
  });

  it("deve detectar automaticamente qualquer idioma do navegador do usuário", () => {
    // Português do Brasil
    expect(matchAppLocale(["pt-BR"])).toEqual({ lang: "pt", extLang: null });
    // Português de Portugal
    expect(matchAppLocale(["pt-PT"])).toEqual({ lang: "pt-PT", extLang: null });
    // Espanhol e variantes
    expect(matchAppLocale(["es-ES"])).toEqual({ lang: "es", extLang: null });
    expect(matchAppLocale(["es-AR"])).toEqual({ lang: "es", extLang: null });
    // Inglês e variantes
    expect(matchAppLocale(["en-US"])).toEqual({ lang: "en", extLang: null });
    expect(matchAppLocale(["en-GB"])).toEqual({ lang: "en", extLang: null });
    // Francês e variantes
    expect(matchAppLocale(["fr-FR"])).toEqual({ lang: "fr", extLang: null });
    expect(matchAppLocale(["fr-CA"])).toEqual({ lang: "fr", extLang: null });
    // Alemão e variantes
    expect(matchAppLocale(["de-DE"])).toEqual({ lang: "de", extLang: null });
    expect(matchAppLocale(["de-AT"])).toEqual({ lang: "de", extLang: null });
    // Italiano
    expect(matchAppLocale(["it-IT"])).toEqual({ lang: "it", extLang: null });

    // Idiomas extras do app (ex: japonês, russo, árabe, ucraniano, afrikaans)
    expect(matchAppLocale(["ja"])).toEqual({ lang: "en", extLang: "ja" });
    expect(matchAppLocale(["ru-RU"])).toEqual({ lang: "en", extLang: "ru" });
    expect(matchAppLocale(["ar-SA"])).toEqual({ lang: "en", extLang: "ar" });
    expect(matchAppLocale(["uk-UA"])).toEqual({ lang: "en", extLang: "uk" });
    expect(matchAppLocale(["af"])).toEqual({ lang: "en", extLang: "af" });
    expect(matchAppLocale(["zh-CN"])).toEqual({ lang: "en", extLang: "zh-CN" });
  });

  it("deve resolver parâmetros explícitos ?lang=... para todas as variantes regionais", () => {
    expect(resolveRequestedAppLocale("es-AR")).toEqual({ lang: "es", extLang: null });
    expect(resolveRequestedAppLocale("es-ES")).toEqual({ lang: "es", extLang: null });
    expect(resolveRequestedAppLocale("en-GB")).toEqual({ lang: "en", extLang: null });
    expect(resolveRequestedAppLocale("fr-CA")).toEqual({ lang: "fr", extLang: null });
    expect(resolveRequestedAppLocale("de-AT")).toEqual({ lang: "de", extLang: null });
    expect(resolveRequestedAppLocale("de-CH")).toEqual({ lang: "de", extLang: null });
  });
});
