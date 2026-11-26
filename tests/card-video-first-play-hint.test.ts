import { describe, expect, test } from "bun:test";
import { UI_TABLE } from "../src/lib/i18n-ui";

// Na primeira reprodução do vídeo, enquanto a narração é preparada (o "spinning"
// gira), o aluno vê um aviso amigável explicando que o vídeo só fica registrado
// se for reproduzido até o fim. O texto precisa existir nos 7 idiomas nativos.
const KEY =
  "Reproduza o vídeo até o fim para que seja registrado no seu flashcard. Na próxima reprodução o vídeo será instantâneo.";

describe("FlashPilot-TV first-play hint", () => {
  test("the hint is translated for every native language", () => {
    const row = UI_TABLE[KEY];
    expect(row).toBeDefined();
    // Colunas: [en, es, fr, it, de, pt-PT]
    for (const text of row) expect(text.trim().length).toBeGreaterThan(0);
    expect(row[0]).toContain("flashcard");
    expect(row[1]).toContain("flashcard");
  });

  test("the hint never says IA/AI to the student", () => {
    const row = UI_TABLE[KEY];
    for (const text of row) {
      const lower = text.toLowerCase();
      expect(lower).not.toContain("inteligência artificial");
      expect(lower).not.toContain("artificial intelligence");
      expect(lower).not.toContain(" artificial intelligence");
    }
    expect(KEY.toLowerCase()).not.toContain("ia ");
  });

  test("the hint promises an instant next playback", () => {
    const row = UI_TABLE[KEY];
    expect(KEY).toContain("instantâneo");
    expect(row[0].toLowerCase()).toContain("instantly");
    expect(row[5].toLowerCase()).toContain("instantâneo");
  });
});
