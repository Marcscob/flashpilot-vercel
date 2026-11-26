import { describe, expect, test } from "bun:test";
import { COMMERCE_DICTS } from "../src/lib/i18n-commerce";

// Pro 2 precisa aparecer rotulado em todos os 7 idiomas nativos da interface.
const LANGS = ["pt", "pt-PT", "es", "en", "fr", "it", "de"] as const;

describe("Pro 2 plan labels", () => {
  test("every native language has monthly/yearly Pro 2 labels and the Pro 2 badge", () => {
    for (const lang of LANGS) {
      const pricing = COMMERCE_DICTS[lang].pricing;
      expect(pricing.monthly2.startsWith("Pro 2 ")).toBe(true);
      expect(pricing.yearly2.startsWith("Pro 2 ")).toBe(true);
      expect(pricing.plan2).toBe("Pro 2");
    }
    expect(COMMERCE_DICTS.pt.pricing.monthly2).toBe("Pro 2 Mensal");
    expect(COMMERCE_DICTS["pt-PT"].pricing.yearly2).toBe("Pro 2 Anual");
    expect(COMMERCE_DICTS.en.pricing.monthly2).toBe("Pro 2 Monthly");
    expect(COMMERCE_DICTS.en.pricing.yearly2).toBe("Pro 2 Yearly");
    expect(COMMERCE_DICTS.es.pricing.yearly2).toBe("Pro 2 Anual");
    expect(COMMERCE_DICTS.fr.pricing.monthly2).toBe("Pro 2 Mensuel");
    expect(COMMERCE_DICTS.it.pricing.monthly2).toBe("Pro 2 Mensile");
    expect(COMMERCE_DICTS.de.pricing.monthly2).toBe("Pro 2 Monatlich");
  });

  test("AI cycle quota line uses PilotAI wording and the correct 700 vs 2200 split", () => {
    for (const lang of LANGS) {
      const line = COMMERCE_DICTS[lang].pricing.aiCycleCards("700");
      expect(line).toContain("700");
      expect(line).toContain("PilotAI");
      // Nunca expor "inteligência artificial"/"artificial intelligence" ao usuário.
      expect(line.toLowerCase()).not.toContain("inteligência artificial");
      expect(line.toLowerCase()).not.toContain("artificial intelligence");
    }
    expect(COMMERCE_DICTS.pt.pricing.aiCycleCards("2200")).toContain("2200");
    expect(COMMERCE_DICTS.en.pricing.aiCycleCards("2200")).toBe("PilotAI quota: 2200 cards per cycle");
  });
});
