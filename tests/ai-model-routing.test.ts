import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const source = (file: string) => readFileSync(`src/lib/${file}`, "utf8");
const LITE = "gemini-3.1-flash-lite";
const PREVIEW = "gemini-3-flash-preview";
const PRO = "gemini-3.1-pro-preview";

/** Modelo principal de cada rota de IA; mudanças aqui devem vir de uma avaliação (scripts/eval). */
const ROUTES: Array<[string, string, string]> = [
  ["cards por texto", "parse-cards.functions.ts", `model: geminiModel("google/${LITE}")`],
  [
    "cards por documento",
    "parse-cards-file.functions.ts",
    `const GEMINI_MODEL = geminiModel("google/${LITE}")`,
  ],
  ["cards por foto", "parse-cards-image.functions.ts", `model: geminiModel("google/${LITE}")`],
  ["PDF escaneado", "parse-cards-file.functions.ts", `const PDF_GEMINI_MODEL = "${PREVIEW}"`],
  ["ImagePilot", "imagepilot.functions.ts", `model: geminiModel("google/${PRO}")`],
  ["utilitários leves", "gemini-api.server.ts", `const LIGHT_GEMINI_MODEL = "${LITE}"`],
  ["voz para texto", "stt.functions.ts", `geminiGenerateContentUrl("${LITE}")`],
  ["prazos", "prazos-scan.server.ts", `geminiModel("google/${LITE}")`],
  ["formatação de notas", "notes-format.server.ts", `geminiModel("google/${LITE}")`],
  ["blog (texto)", "blog-ai.server.ts", `geminiModel("google/${LITE}")`],
  ["blog (tradução ao vivo)", "blog-live-translate.server.ts", `geminiModel("google/${LITE}")`],
  [
    "landing: áudio",
    "landing-visitor-source.functions.ts",
    `{ model: "${LITE}", speechOnly: true }`,
  ],
  ["landing: foto (OCR)", "landing-visitor-source.functions.ts", `{ model: "${PREVIEW}" }`],
];

describe("roteamento de modelos de IA", () => {
  for (const [name, file, expected] of ROUTES) {
    it(`${name} usa o modelo avaliado`, () => {
      expect(source(file).replace(/\r\n/g, "\n")).toContain(expected);
    });
  }

  it("a extração nativa da landing não envia Authorization com a chave de API", () => {
    const text = source("landing-visitor-source.functions.ts");
    expect(text).not.toContain("geminiHeaders(");
    expect(text).toContain('"x-goog-api-key": key');
  });

  it("transcrição descarta áudio sem fala por saída estruturada", () => {
    expect(source("stt.functions.ts")).toContain("has_speech");
    expect(source("landing-visitor-source.functions.ts")).toContain("has_speech");
  });
});
