/** Gera lang-data.json: a mesma frase traduzida em cada idioma (gabarito para STT/TTS e tutor). Uso: bun scripts/eval/gen-lang-data.ts */
import { writeFileSync } from "node:fs";
import { BASE_SENTENCE, LANGS } from "./langs";
import { generate, parseJson } from "./lib";

const result: Record<string, string> = {};
const chunks: (typeof LANGS)[] = [];
for (let i = 0; i < LANGS.length; i += 20) chunks.push(LANGS.slice(i, i + 20));
for (const chunk of chunks) {
  const g = await generate("gemini-3.1-pro-preview", {
    json: true,
    temperature: 0,
    maxOutputTokens: 8000,
    system: `Translate the English sentence into each requested language, naturally and correctly, as a native speaker would write it (use the standard script of each language: Cyrillic for ru/uk/bg, Arabic script for ar/fa, etc.). Keep the numbers and meaning exact. Return ONLY JSON mapping each language code to its translation.`,
    parts: [{ text: `Sentence: ${BASE_SENTENCE}\nLanguages (code: name):\n${chunk.map((l) => `${l.code}: ${l.name}`).join("\n")}` }],
  });
  Object.assign(result, parseJson<Record<string, string>>(g.text) ?? {});
}
const missing = LANGS.filter((l) => !result[l.code]).map((l) => l.code);
writeFileSync(new URL("./lang-data.json", import.meta.url), JSON.stringify(result, null, 1));
console.log("idiomas", Object.keys(result).length, "faltando", missing.join(",") || "nenhum");
