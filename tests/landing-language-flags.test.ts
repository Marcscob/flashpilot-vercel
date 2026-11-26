import { describe, expect, it } from "bun:test";
import { BLOG_LANGS } from "../src/lib/blog-langs";
import {
  LANDING_COUNTRY_LANGS,
  landingCountryName,
  landingLanguageFlag,
} from "../src/lib/landing-language-flags";
import { flagToCountry } from "../src/components/FlagIcon";

describe("Homepage country flags", () => {
  it("renders a country flag image code for each of the 52 app languages", () => {
    expect(BLOG_LANGS).toHaveLength(52);
    for (const { code } of BLOG_LANGS) {
      const countryCode = flagToCountry(landingLanguageFlag(code));
      expect(countryCode, code).not.toBeNull();
      expect(countryCode).toMatch(/^[a-z]{2}$/);
    }
  });

  it("shows each country only once in the homepage marquee", () => {
    const countryCodes = LANDING_COUNTRY_LANGS.map((language) =>
      flagToCountry(landingLanguageFlag(language.code)),
    );

    expect(new Set(countryCodes).size).toBe(countryCodes.length);
    expect(
      LANDING_COUNTRY_LANGS.filter(
        (language) => flagToCountry(landingLanguageFlag(language.code)) === "es",
      ),
    ).toHaveLength(1);
    expect(
      LANDING_COUNTRY_LANGS.find(
        (language) => flagToCountry(landingLanguageFlag(language.code)) === "es",
      )?.code,
    ).toBe("es-ES");
  });

  it("localizes every associated country name in all 52 page languages", () => {
    for (const pageLanguage of BLOG_LANGS) {
      for (const countryLanguage of BLOG_LANGS) {
        const name = landingCountryName(countryLanguage.code, pageLanguage.code);
        expect(name.length).toBeGreaterThan(1);
        expect(name).not.toMatch(/^[A-Z]{2}$/);
      }
    }

    expect(landingCountryName("en", "de")).toBe("Vereinigte Staaten");
    expect(landingCountryName("es", "de")).toBe("Mexiko");
    expect(landingCountryName("de", "es")).toBe("Alemania");
  });
});
