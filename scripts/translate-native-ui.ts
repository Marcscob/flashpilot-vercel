import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUDIT_UI_ENGLISH } from "../src/lib/i18n-ui";
import { geminiApiKey, geminiGenerateContentUrl, geminiModel } from "../src/lib/gemini-api.server";

const OUT = fileURLToPath(new URL("../src/lib/i18n-ui-audit-native.json", import.meta.url));
const MODEL = geminiModel("google/gemini-3.1-flash-lite");
const CHUNK_SIZE = 120;
const LANGUAGES = [
  { index: 0, name: "Spanish" },
  { index: 1, name: "French" },
  { index: 2, name: "Italian" },
  { index: 3, name: "German" },
  { index: 4, name: "European Portuguese" },
] as const;
type NativeRow = [string, string, string, string, string];

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

function loadTranslations(): Record<string, NativeRow> {
  if (!existsSync(OUT)) return {};
  return JSON.parse(readFileSync(OUT, "utf8")) as Record<string, NativeRow>;
}

function saveTranslations(translations: Record<string, NativeRow>) {
  const temporary = `${OUT}.tmp`;
  writeFileSync(temporary, JSON.stringify(translations, null, 2) + "\n");
  renameSync(temporary, OUT);
}

async function translateChunk(
  texts: string[],
  language: string,
  apiKey: string,
): Promise<string[]> {
  const response = await fetch(geminiGenerateContentUrl(MODEL), {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text:
              `Translate FlashPilot user-interface strings from English into ${language}. ` +
              "Return exactly one translation for every indexed input, preserving all indexes and placeholders such as {name}. " +
              "Keep FlashPilot, PilotAI, FlashCoins, and product names unchanged. Use concise, natural UI wording.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: JSON.stringify(texts.map((text, index) => ({ index, text }))) }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          required: ["items"],
          properties: {
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                required: ["index", "translation"],
                properties: {
                  index: { type: "INTEGER" },
                  translation: { type: "STRING" },
                },
              },
            },
          },
        },
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini HTTP ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const output = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
  if (!output) throw new Error("Gemini returned no translation content.");

  const parsed = JSON.parse(output) as { items?: unknown };
  if (!Array.isArray(parsed.items)) throw new Error("Gemini returned an invalid translation list.");
  const translations: Array<string | undefined> = Array(texts.length);
  for (const item of parsed.items) {
    if (
      !item ||
      typeof item !== "object" ||
      !Number.isInteger((item as { index?: unknown }).index) ||
      typeof (item as { translation?: unknown }).translation !== "string"
    ) {
      throw new Error("Gemini returned an invalid translation item.");
    }
    const { index, translation } = item as { index: number; translation: string };
    if (index < 0 || index >= texts.length) continue;
    if (translations[index] !== undefined)
      throw new Error(`Gemini returned duplicate translation index ${index}.`);
    translations[index] = translation;
  }

  return translations.map((translation, index) => {
    const source = texts[index]!;
    if (!translation?.trim()) throw new Error(`Gemini omitted translation index ${index}.`);
    if (JSON.stringify(placeholders(source)) !== JSON.stringify(placeholders(translation))) {
      throw new Error(`Gemini changed placeholders at index ${index}.`);
    }
    return translation.trim();
  });
}

const translations = loadTranslations();
const entries = Object.entries(AUDIT_UI_ENGLISH);
const plans = LANGUAGES.map((language) => ({
  language,
  missing: entries.filter(([source]) => !translations[source]?.[language.index]),
}));
const dryRun = process.argv.includes("--dry-run");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--dry-run");
if (unknownArgs.length) throw new Error(`Unknown option(s): ${unknownArgs.join(", ")}`);

if (dryRun) {
  let totalCalls = 0;
  for (const { language, missing } of plans) {
    const calls = Math.ceil(missing.length / CHUNK_SIZE);
    totalCalls += calls;
    console.log(`${language.name}: ${missing.length} strings; ${calls} API calls`);
  }
  console.log(`TOTAL: ${totalCalls} Gemini API calls; no API requests made.`);
  process.exit(0);
}

if (plans.every(({ missing }) => missing.length === 0)) {
  console.log("All native audit UI translations are complete.");
  process.exit(0);
}

const apiKey = geminiApiKey();
if (!apiKey) throw new Error("GEMINI_API_KEY is required for translation runs.");

for (const { language, missing } of plans) {
  if (!missing.length) {
    console.log(`skip ${language.name}`);
    continue;
  }

  for (let offset = 0; offset < missing.length; offset += CHUNK_SIZE) {
    const chunk = missing.slice(offset, offset + CHUNK_SIZE);
    const translated = await translateChunk(
      chunk.map(([, english]) => english),
      language.name,
      apiKey,
    );
    chunk.forEach(([source], index) => {
      const row = translations[source] ?? ["", "", "", "", ""];
      row[language.index] = translated[index]!;
      translations[source] = row;
    });
    saveTranslations(translations);
    console.log(
      `Saved ${language.name}: ${Math.min(offset + chunk.length, missing.length)}/${missing.length}`,
    );
  }
}
