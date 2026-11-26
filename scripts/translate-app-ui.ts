/**
 * Gera public/i18n/<code>.json para os idiomas do app além dos 7 nativos.
 * Inspeção sem chamadas: bun scripts/translate-app-ui.ts --dry-run [code ...]
 * Validação completa: bun scripts/translate-app-ui.ts --check --all
 * Tradução direta Gemini: bun scripts/translate-app-ui.ts --max-calls N <code ...>
 * Execuções reais exigem GEMINI_API_KEY, idiomas explícitos e limite de chamadas.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { geminiApiKey, geminiGenerateContentUrl, geminiModel } from "../src/lib/gemini-api.server";
import { DICTS } from "../src/lib/i18n";
import { EXTRA_DICTS } from "../src/lib/i18n-extra";
import { UI_TABLE } from "../src/lib/i18n-ui";
import { APP_EXT_LANGS } from "../src/lib/app-ext-langs";
import { AUTH_FLOW_SOURCE } from "../src/lib/auth-flow-i18n";
import { AUDIT_EN, studyCopy } from "../src/lib/i18n-audit";
import { SCREENS_EN } from "../src/lib/i18n-screens";
import { BULK_EN } from "../src/lib/i18n-bulk";
import { COMMERCE_DICTS } from "../src/lib/i18n-commerce";
import {
  BULK_V2_ENGLISH_SOURCE,
  CAPTURE_GROUP_TRANSLATIONS,
  type BulkV2Copy,
} from "../src/lib/i18n-bulk-v2";
import { PANEL_DICTS } from "../src/lib/i18n-panel";
import { landingCopy } from "../src/lib/landing-content";
import { landingLegacyCopy } from "../src/lib/landing-copy";
import { landingEntryCopy } from "../src/lib/landing-entry-copy";
import { landingPilotCopy } from "../src/lib/landing-pilot-copy";
import { INSTALL_COPY_EN } from "../src/lib/pwa-install";
import { refundCopy } from "../src/lib/refund-copy";
import { ledgerCopy } from "../src/lib/ledger-labels";
import { LANDING_SUBTITLE } from "../src/lib/landing-head";
import { BLOG_NEWSLETTER_COPY_KEYS } from "../src/lib/email-templates/blog-newsletter-copy";

const OUT = fileURLToPath(new URL("../public/i18n/", import.meta.url));
const NEWSLETTER_OUT = fileURLToPath(
  new URL("../src/lib/email-templates/blog-newsletter-extra-translations.json", import.meta.url),
);
const MODEL = geminiModel("google/gemini-3.1-flash-lite");
const CHUNK_SIZE = 120;
const CHARS_PER_TOKEN_ESTIMATE = 4;
mkdirSync(OUT, { recursive: true });

// Fonte: caminho -> texto (dict) e fonte pt -> inglês (tabela T()).
const dictSrc: Record<string, string> = {};
const walk = (value: unknown, prefix: string) => {
  if (typeof value === "string") {
    dictSrc[prefix] = value;
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, `${prefix}.${index}`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === "string") dictSrc[path] = entry;
    else if (entry && typeof entry === "object") walk(entry, path);
  }
};
const walkDeep = (value: unknown, prefix: string) => {
  if (typeof value === "string") {
    dictSrc[prefix] = value;
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkDeep(entry, `${prefix}.${index}`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      walkDeep(entry, prefix ? `${prefix}.${key}` : key);
    }
  }
};
const walkCommerceFunctions = (value: unknown, prefix: string) => {
  if (typeof value === "function") {
    const args = Array.from({ length: value.length }, (_, index) => `__FP_ARG${index}__`);
    const result = value(...args);
    if (typeof result !== "string") {
      throw new Error(`Commerce translation source did not return text at ${prefix}.`);
    }
    dictSrc[prefix] = result.replace(/__FP_ARG(\d+)__/g, "{arg$1}");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkCommerceFunctions(entry, `${prefix}.${index}`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      walkCommerceFunctions(entry, prefix ? `${prefix}.${key}` : key);
    }
  }
};
walk(DICTS.en, "");
walkCommerceFunctions(COMMERCE_DICTS.en, "");
const englishLegal = EXTRA_DICTS.en.legal;
walkDeep(
  {
    terms: {
      ...englishLegal.terms,
      sections: englishLegal.terms.sections({ email: "{email}" }),
    },
    privacy: {
      ...englishLegal.privacy,
      sections: englishLegal.privacy.sections({ email: "{email}" }),
    },
  },
  "legal",
);
walk(AUDIT_EN, "audit");
walk(studyCopy("en"), "study");
walk(SCREENS_EN, "screens");
walk(BULK_EN, "bulk");
walk(BULK_V2_ENGLISH_SOURCE, "bulkv2");
walk(PANEL_DICTS.en, "panel");
walkDeep(landingCopy("en"), "landing");
walkDeep(landingLegacyCopy("en"), "landingCapture");
walkDeep(landingEntryCopy("en"), "landingEntry");
walkDeep(landingPilotCopy("en"), "landingPilot");
walkDeep(INSTALL_COPY_EN, "pwa");
const refundLandingCopy = refundCopy("en");
walkDeep(refundLandingCopy, "refund");
walkDeep(ledgerCopy("en"), "ledger");
dictSrc["landing.headSubtitle"] = LANDING_SUBTITLE.en!;

const uiSrc: Record<string, string> = {};
for (const [pt, row] of Object.entries(UI_TABLE as Record<string, string[]>)) {
  if (row[0]) uiSrc[pt] = row[0];
}
for (const [key, value] of Object.entries(AUTH_FLOW_SOURCE)) uiSrc[`af:${key}`] = value;

const entries: [string, string][] = [
  ...Object.entries(dictSrc).map(([key, value]) => [`d:${key}`, value] as [string, string]),
  ...Object.entries(uiSrc).map(([key, value]) => [`u:${key}`, value] as [string, string]),
].filter(([, value]) => value.trim().length > 0);

function translationInstructions(langName: string): string {
  return (
    `You translate user-interface strings of FlashPilot (a flashcard study app) from English into ${langName}. ` +
    `Input is a JSON array of objects with index and text. Return exactly one object per input with the same index and its translated text in translation. ` +
    `Keep every index unchanged; do not omit or add objects. Keep placeholders like {name}, emojis, HTML, ` +
    `URLs, "FlashPilot", "PilotAI", "FlashCoins", "ImagePilot", "Pomodoro", "Telegram" unchanged. Never write "AI" for the app's engine; it is "PilotAI". Short, natural UI wording.`
  );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

async function translateChunk(texts: string[], langName: string): Promise<string[]> {
  const apiKey = geminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for translation runs.");

  const response = await fetch(geminiGenerateContentUrl(MODEL), {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: translationInstructions(langName) }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: JSON.stringify(texts.map((text, index) => ({ index, text }))),
            },
          ],
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
  if (
    !Array.isArray(parsed.items) ||
    parsed.items.some(
      (item) =>
        !item ||
        typeof item !== "object" ||
        !Number.isInteger((item as { index?: unknown }).index) ||
        typeof (item as { translation?: unknown }).translation !== "string",
    )
  ) {
    throw new Error("Gemini returned an invalid translation list.");
  }
  const translations: Array<string | undefined> = Array(texts.length);
  for (const item of parsed.items as Array<{ index: number; translation: string }>) {
    if (item.index < 0 || item.index >= texts.length) continue;
    if (translations[item.index] !== undefined) {
      throw new Error(`Gemini returned duplicate translation index ${item.index}.`);
    }
    translations[item.index] = item.translation;
  }
  const missingTranslations = translations.flatMap((item, index) =>
    item === undefined ? [index] : [],
  );
  if (missingTranslations.length) {
    throw new Error(`Gemini omitted translation indexes: ${missingTranslations.join(", ")}.`);
  }
  return translations.map((item, index) => {
    const source = texts[index]!;
    const translation = item!;
    if (!translation.trim())
      throw new Error(`Gemini returned an empty translation at index ${index}.`);
    if (JSON.stringify(placeholders(source)) !== JSON.stringify(placeholders(translation))) {
      throw new Error(`Gemini changed placeholders at index ${index}.`);
    }
    const leadingWhitespace = source.match(/^\s*/)?.[0] ?? "";
    const trailingWhitespace = source.match(/\s*$/)?.[0] ?? "";
    return `${leadingWhitespace}${translation.trim()}${trailingWhitespace}`;
  });
}

function readOverlay(code: string): { d: Record<string, string>; u: Record<string, string> } {
  const file = join(OUT, `${code}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { d: {}, u: {} };
}

function hasStaticBulkV2Translation(code: string, key: string): boolean {
  const prefix = "bulkv2.";
  if (!key.startsWith(prefix)) return false;
  const sourceKey = key.slice(prefix.length) as keyof BulkV2Copy;
  return typeof CAPTURE_GROUP_TRANSLATIONS[code]?.[sourceKey] !== "undefined";
}

function missingEntries(
  result: { d: Record<string, string>; u: Record<string, string> },
  code: string,
) {
  return entries.filter(([key]) => {
    if (key.startsWith("d:")) {
      const sourceKey = key.slice(2);
      return !result.d[sourceKey] && !hasStaticBulkV2Translation(code, sourceKey);
    }
    return !result.u[key.slice(2)];
  });
}

function chunksOf<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function saveOverlay(
  file: string,
  result: { d: Record<string, string>; u: Record<string, string> },
) {
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(result));
  renameSync(temporary, file);
}

function readNewsletterTranslations(): Record<string, Record<string, string>> {
  if (!existsSync(NEWSLETTER_OUT)) return {};
  return JSON.parse(readFileSync(NEWSLETTER_OUT, "utf8"));
}

function syncNewsletterTranslations() {
  const translations = readNewsletterTranslations();
  const missing: string[] = [];

  for (const language of APP_EXT_LANGS) {
    const overlay = readOverlay(language.code);
    const row = Object.fromEntries(
      BLOG_NEWSLETTER_COPY_KEYS.flatMap((key) => (overlay.u[key] ? [[key, overlay.u[key]!]] : [])),
    );
    if (BLOG_NEWSLETTER_COPY_KEYS.every((key) => row[key])) {
      translations[language.code] = row;
    } else if (!BLOG_NEWSLETTER_COPY_KEYS.every((key) => translations[language.code]?.[key])) {
      missing.push(language.code);
    }
  }

  const temporary = `${NEWSLETTER_OUT}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(translations, null, 2)}\n`);
  renameSync(temporary, NEWSLETTER_OUT);
  if (missing.length) {
    console.error(`Newsletter email translations are incomplete for: ${missing.join(", ")}.`);
    process.exitCode = 1;
  }
}

function parseArgs(args: string[]) {
  let dryRun = false;
  let check = false;
  let allLanguages = false;
  let maxCalls: number | null = null;
  const requestedCodes: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--check") {
      check = true;
    } else if (arg === "--all") {
      allLanguages = true;
    } else if (arg === "--max-calls") {
      const value = Number(args[++i]);
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error("--max-calls must be a positive integer.");
      }
      maxCalls = value;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      requestedCodes.push(arg);
    }
  }

  if ((dryRun || check) && maxCalls !== null)
    throw new Error("--max-calls cannot be combined with --dry-run or --check.");
  if (dryRun && check) throw new Error("--dry-run and --check cannot be combined.");
  if (allLanguages && requestedCodes.length)
    throw new Error("--all cannot be combined with language codes.");
  if (!dryRun && !check && ((!requestedCodes.length && !allLanguages) || maxCalls === null)) {
    throw new Error("Real runs require explicit language codes or --all, and --max-calls N.");
  }

  const unknownCodes = requestedCodes.filter(
    (code) => !APP_EXT_LANGS.some((language) => language.code === code),
  );
  if (unknownCodes.length)
    throw new Error(`Unsupported language code(s): ${unknownCodes.join(", ")}`);

  return { dryRun, check, maxCalls, requestedCodes, allLanguages };
}

async function runDryRun(languages: typeof APP_EXT_LANGS) {
  let totalStrings = 0;
  let totalCalls = 0;
  let totalInputChars = 0;
  let totalOutputChars = 0;

  for (const language of languages) {
    const todo = missingEntries(readOverlay(language.code), language.code);
    if (!todo.length) {
      console.log(`${language.code}: complete`);
      continue;
    }

    const chunks = chunksOf(todo, CHUNK_SIZE);
    const instructionChars = translationInstructions(language.name).length;
    const inputChars = chunks.reduce(
      (sum, chunk) =>
        sum + instructionChars + JSON.stringify(chunk.map((entry) => entry[1])).length,
      0,
    );
    const outputChars = todo.reduce((sum, entry) => sum + Math.ceil(entry[1].length * 1.35), 0);
    totalStrings += todo.length;
    totalCalls += chunks.length;
    totalInputChars += inputChars;
    totalOutputChars += outputChars;
    console.log(
      `${language.code}: ${todo.length} strings; ${chunks.length} calls; ` +
        `~${Math.ceil(inputChars / CHARS_PER_TOKEN_ESTIMATE)} input tokens; ` +
        `~${Math.ceil(outputChars / CHARS_PER_TOKEN_ESTIMATE)} output tokens`,
    );
  }

  console.log(
    `TOTAL: ${totalStrings} strings; ${totalCalls} calls; ` +
      `~${Math.ceil(totalInputChars / CHARS_PER_TOKEN_ESTIMATE)} input tokens; ` +
      `~${Math.ceil(totalOutputChars / CHARS_PER_TOKEN_ESTIMATE)} output tokens ` +
      `(rough estimate; no API calls made).`,
  );
}

function runCheck(languages: typeof APP_EXT_LANGS) {
  const newsletterTranslations = readNewsletterTranslations();
  const issues = languages.flatMap((language) => {
    const overlay = readOverlay(language.code);
    const missing = missingEntries(overlay, language.code);
    const missingNewsletter = BLOG_NEWSLETTER_COPY_KEYS.filter(
      (key) =>
        !newsletterTranslations[language.code]?.[key] ||
        newsletterTranslations[language.code]?.[key] !== overlay.u[key],
    );
    const invalid = entries.filter(([key, source]) => {
      const translated = key.startsWith("d:") ? overlay.d[key.slice(2)] : overlay.u[key.slice(2)];
      return (
        translated &&
        JSON.stringify(placeholders(source)) !== JSON.stringify(placeholders(translated))
      );
    });
    const counts = [
      missing.length ? `${missing.length} missing translations` : "",
      missingNewsletter.length
        ? `${missingNewsletter.length} newsletter email translations missing or out of date`
        : "",
      invalid.length ? `${invalid.length} translations with changed placeholders` : "",
    ].filter(Boolean);
    return counts.length ? [`${language.code}: ${counts.join(", ")}`] : [];
  });
  if (issues.length) {
    console.error(issues.join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(
    `All ${languages.length} extra-language overlays cover the current translation inventory.`,
  );
}

async function runLanguage(
  code: string,
  name: string,
  budget: { limit: number; used: number },
): Promise<boolean> {
  const file = join(OUT, `${code}.json`);
  const result = readOverlay(code);
  const todo = missingEntries(result, code);
  if (!todo.length) {
    console.log(`skip ${code}`);
    return true;
  }

  for (const chunk of chunksOf(todo, CHUNK_SIZE)) {
    if (budget.used >= budget.limit) {
      console.log(`Paused ${code}: call limit reached; remaining strings stay untranslated.`);
      return false;
    }

    budget.used++;
    const translations = await translateChunk(
      chunk.map((entry) => entry[1]),
      name,
    );
    chunk.forEach(([key], index) => {
      if (key.startsWith("d:")) result.d[key.slice(2)] = translations[index]!;
      else result.u[key.slice(2)] = translations[index]!;
    });
    saveOverlay(file, result);
    console.log(`ok ${code}: saved chunk; ${budget.used}/${budget.limit} API calls used`);
  }

  return true;
}

const options = parseArgs(process.argv.slice(2));
const languages = options.allLanguages
  ? APP_EXT_LANGS
  : options.requestedCodes.length
    ? APP_EXT_LANGS.filter((language) => options.requestedCodes.includes(language.code))
    : APP_EXT_LANGS;

if (options.dryRun) {
  await runDryRun(languages);
} else if (options.check) {
  runCheck(languages);
} else {
  if (!geminiApiKey()) throw new Error("Set GEMINI_API_KEY before running translations.");
  const budget = { limit: options.maxCalls!, used: 0 };
  for (const language of languages) {
    const complete = await runLanguage(language.code, language.name, budget);
    if (!complete) break;
  }
  syncNewsletterTranslations();
}
