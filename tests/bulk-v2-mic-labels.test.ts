import { describe, expect, test } from "bun:test";
import { COPY } from "../src/lib/i18n-bulk-v2";

// O botão de narração do Bulk v2 grava ao toque e precisa mostrar o próprio
// estado ("Gravando…" / "Transcrevendo…") nos 7 idiomas nativos da interface.
const LANGS = ["pt", "pt-PT", "es", "en", "fr", "it", "de"] as const;

describe("Bulk v2 narration button states", () => {
  test("every native language names the recording and transcribing states", () => {
    for (const lang of LANGS) {
      expect(COPY[lang].recording.trim().length).toBeGreaterThan(0);
      expect(COPY[lang].transcribing.trim().length).toBeGreaterThan(0);
      // Nunca expor "IA"/"AI"/"inteligência artificial" ao usuário.
      expect(COPY[lang].recording.toLowerCase()).not.toContain("inteligência artificial");
      expect(COPY[lang].transcribing.toLowerCase()).not.toContain("artificial intelligence");
    }
    expect(COPY.pt.recording).toBe("Gravando…");
    expect(COPY["pt-PT"].recording).toBe("Gravando…");
    expect(COPY.pt.transcribing).toBe("Transcrevendo…");
    expect(COPY.en.recording).toBe("Recording…");
    expect(COPY.en.transcribing).toBe("Transcribing…");
    expect(COPY.es.recording).toBe("Grabando…");
    expect(COPY.fr.recording).toBe("Enregistrement…");
    expect(COPY.it.recording).toBe("Registrazione…");
    expect(COPY.de.recording).toBe("Aufnahme…");
  });

  test("the recording state is shorter than the option label so the button keeps its size", () => {
    for (const lang of LANGS) {
      expect(COPY[lang].recording.length).toBeLessThan(COPY[lang].narrateAudio.length + 6);
    }
  });
});
