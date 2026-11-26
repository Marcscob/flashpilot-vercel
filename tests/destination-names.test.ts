import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  fallbackNamesFromCards,
  isGenericName,
  pickUsableNames,
} from "../src/lib/destination-names";

describe("destination names", () => {
  test("detects generic names", () => {
    for (const name of [
      "",
      "Matéria Demo",
      "Assunto Demo",
      "Flashcards inteligentes com o PilotAI",
      "FlashPilot",
      "Resultado do seu teste",
      "Geral",
    ]) {
      expect(isGenericName(name)).toBe(true);
    }
    expect(isGenericName("Física")).toBe(false);
    expect(isGenericName("Velocidade média")).toBe(false);
  });

  test("keeps usable names and flags the missing one", () => {
    expect(pickUsableNames("Física", "Assunto Demo")).toEqual({
      subject: "Física",
      topic: "",
      complete: false,
    });
    expect(pickUsableNames("Física", "Velocidade média").complete).toBe(true);
  });

  test("fallback derives the topic from the first question", () => {
    const names = fallbackNamesFromCards([{ question: "O que é velocidade média?" }], "pt-BR");
    expect(names.topic).toBe("O que é velocidade média");
    expect(names.subject).not.toBe("");
  });
});

describe("shared card guidelines", () => {
  const read = (f: string) => readFileSync(join("src", "lib", f), "utf8");

  test("landing and Bulk v2 generators use the same guidelines", () => {
    expect(read("landing-cards-prompt.ts")).toContain("sharedCardGuidelines");
    expect(read("parse-cards-file.functions.ts")).toContain("sharedCardGuidelines");
    expect(read("parse-cards-image.functions.ts")).toContain("sharedCardGuidelines");
  });

  test("no hard-coded generic destination names remain", () => {
    const banned = /Matéria Demo|Assunto Demo|Flashcards inteligentes com o PilotAI/;
    const offenders = readdirSync("src/lib")
      .filter(
        (f) =>
          f.endsWith(".ts") &&
          ![
            "destination-names.ts",
            "destination-names.server.ts",
            "card-guidelines.ts",
            "i18n-ui.ts",
          ].includes(f),
      )
      .filter((f) => banned.test(read(f)));
    expect(offenders).toEqual([]);
  });
});
