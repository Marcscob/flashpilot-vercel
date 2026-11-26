import { describe, expect, test } from "bun:test";
import { COPY } from "../src/lib/i18n-bulk-v2";

// O aviso de custo precisa aparecer nos 7 idiomas nativos da interface.
const LANGS = ["pt", "pt-PT", "es", "en", "fr", "it", "de"] as const;

describe("Bulk v2 scope cost hint", () => {
  test("every native language warns that the whole capture costs the most FlashCoins", () => {
    for (const lang of LANGS) {
      const note = COPY[lang].scopeAllCost;
      expect(note.trim().length).toBeGreaterThan(0);
      expect(note).toContain("FlashCoins");
      // Nunca expor "IA"/"AI"/"inteligência artificial" ao usuário.
      expect(note.toLowerCase()).not.toContain("inteligência artificial");
      expect(note.toLowerCase()).not.toContain("artificial intelligence");
    }
    expect(COPY.pt.scopeAllCost).toBe("Maior gasto de FlashCoins");
    expect(COPY["pt-PT"].scopeAllCost).toBe("Maior gasto de FlashCoins");
    expect(COPY.en.scopeAllCost).toBe("Highest FlashCoins cost");
    expect(COPY.es.scopeAllCost).toBe("Mayor coste en FlashCoins");
    expect(COPY.fr.scopeAllCost).toBe("Coût en FlashCoins le plus élevé");
    expect(COPY.it.scopeAllCost).toBe("Costo in FlashCoins più alto");
    expect(COPY.de.scopeAllCost).toBe("Höchste FlashCoins-Kosten");
  });
});
