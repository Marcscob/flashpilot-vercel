/**
 * Avaliação de qualidade da IA do FlashPilot, sem Supabase (só GEMINI_API_KEY).
 *
 *   bun scripts/eval/run.ts --dry-run
 *   bun scripts/eval/run.ts --features cards,note,stt --models gemini-3-flash-preview,gemini-3.1-flash-lite
 *   bun scripts/eval/run.ts --save-baseline      grava scripts/eval/baseline.json
 *   bun scripts/eval/run.ts --check              falha (exit 1) se a nota cair além da tolerância
 *
 * Opções: --judge <modelo> (padrão gemini-3.1-pro-preview), --max-calls N (padrão 200),
 * --tolerance 0.3, --no-judge. Relatórios completos em scripts/eval/reports/.
 * Os prompts espelham os de src/lib/landing-visitor.functions.ts,
 * study-note-generate.server.ts e stt.functions.ts; atualize aqui se eles mudarem.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CARD_CASES, NOTE_CASES, STT_CASES } from "./dataset";
import { cardsSystem, languageName, noteSystem } from "./prompts";
import { audioJobs, chatFullJobs, langJobs, visionJobs, type Variant } from "./suites";
import { matchJobs } from "./match-suite";
import { CHAT_CASES, MINDMAP_CASES, PRAZOS_CASES, TRANSLATE_CASES, VIDEO_CASES, evalChat, evalMindmap, evalPrazos, evalTranslate, evalVideo } from "./features";
import { callCount, errorRate, generate, judge, parseJson, setCallLimit, synthesize, type Judgement } from "./lib";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1]! : fallback;
};

const FEATURES = option("features", "cards,note,stt,translate,video,mindmap,prazos,chat,vision,audio,langs,chatfull").split(",");
const MODELS = option("models", "gemini-3-flash-preview,gemini-3.1-flash-lite").split(",");
/** "modelo[:low|:minimal][:max=N]" — variante de raciocínio e limite de tokens de saída. */
const parseSpec = (spec: string) => {
  const [model, ...mods] = spec.split(":");
  return {
    model: model!,
    thinkingLevel: mods.find((m) => m === "low" || m === "minimal" || m === "medium"),
    maxTokens: Number(mods.find((m) => m.startsWith("max="))?.slice(4)) || MAX_TOKENS,
  };
};
const JUDGE_MODEL = option("judge", "gemini-3.1-pro-preview");
const STT_MODEL = "gemini-3-flash-preview";
const TTS_MODEL = "gemini-3.8-flash-tts";
const TOLERANCE = Number(option("tolerance", "0.3"));
const BASELINE = new URL("./baseline.json", import.meta.url);
const REPORTS = new URL("./reports/", import.meta.url);
const USE_JUDGE = !flag("no-judge");
const MAX_TOKENS = 3000; // igual ao app: truncamento por tokens faz parte da qualidade

type Row = {
  feature: string;
  model: string;
  caseId: string;
  checks: Record<string, boolean>;
  checkScore: number;
  judge?: Judgement | null;
  judgeScore?: number;
  errorRate?: number;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  error?: string;
  sample?: string;
};

const score = (checks: Record<string, boolean>) => {
  const values = Object.values(checks);
  return values.filter(Boolean).length / values.length;
};
const judgeAverage = (j: Judgement | null | undefined) =>
  j ? (j.fidelity + j.coverage + j.clarity + j.no_hallucination) / 4 : undefined;

async function evalCards(spec: string, c: (typeof CARD_CASES)[number]): Promise<Row> {
  const { model, thinkingLevel, maxTokens } = parseSpec(spec);
  const g = await generate(model, {
    thinkingLevel,
    system: cardsSystem(c.lang),
    parts: [{ text: `Material de origem:\n${c.text}` }],
    json: true,
    maxOutputTokens: maxTokens,
    temperature: 0.2,
  });
  const parsed = parseJson<{ subject?: string; topic?: string; cards?: Array<Record<string, unknown>> }>(g.text);
  const cards = Array.isArray(parsed?.cards) ? parsed!.cards! : [];
  const strings = cards.every((x) => typeof x.question === "string" && typeof x.answer === "string");
  const formats = new Set(cards.map((x) => String(x.format ?? "")));
  const checks = {
    jsonValido: parsed !== null,
    esquema: cards.length > 0 && strings && Boolean(parsed?.subject) && Boolean(parsed?.topic),
    quantidade: cards.length >= c.minCards && cards.length <= 15,
    semCamposVazios: cards.length > 0 && cards.every((x) => String(x.question).trim() && String(x.answer).trim()),
    semTruncamento: g.finishReason !== "MAX_TOKENS",
    formatosMistos: cards.length < 3 || formats.size >= 2,
  };
  const output = cards.map((x, i) => `${i + 1}. [${x.format}] Q: ${x.question}\n   A: ${x.answer}`).join("\n");
  const j = USE_JUDGE && cards.length ? await judge(JUDGE_MODEL, "flashcard generation", c.text, output, c.language) : undefined;
  return {
    feature: "cards", model: spec, caseId: c.id, checks, checkScore: score(checks), judge: j, judgeScore: judgeAverage(j),
    ms: g.ms, inputTokens: g.usage.inputTokens, outputTokens: g.usage.outputTokens,
    sample: parsed === null ? `[${g.finishReason}] ${g.text}` : output.slice(0, 600),
  };
}

async function evalNote(spec: string, c: (typeof NOTE_CASES)[number]): Promise<Row> {
  const { model, thinkingLevel, maxTokens } = parseSpec(spec);
  const g = await generate(model, {
    thinkingLevel,
    system: noteSystem(c.language),
    parts: [{ text: c.text }],
    json: true,
    maxOutputTokens: maxTokens,
    temperature: 0.2,
  });
  const parsed = parseJson<{ title?: string; text?: string }>(g.text);
  const text = String(parsed?.text ?? "");
  const words = text.split(/\s+/).filter(Boolean).length;
  const bullets = text.split("\n").filter((l) => l.trim().startsWith("- ")).length;
  const checks = {
    jsonValido: parsed !== null,
    titulo: Boolean(parsed?.title) && String(parsed?.title).length <= 80,
    tamanho: words >= 150 && words <= 520,
    topicos: bullets >= 3,
    semTruncamento: g.finishReason !== "MAX_TOKENS",
  };
  const j = USE_JUDGE && text ? await judge(JUDGE_MODEL, "study note synthesis (3 sections)", c.text, text, c.language) : undefined;
  return {
    feature: "note", model: spec, caseId: c.id, checks, checkScore: score(checks), judge: j, judgeScore: judgeAverage(j),
    ms: g.ms, inputTokens: g.usage.inputTokens, outputTokens: g.usage.outputTokens, sample: text.slice(0, 600),
  };
}

async function evalStt(c: (typeof STT_CASES)[number]): Promise<Row> {
  const wav = await synthesize(TTS_MODEL, c.text);
  const prompt =
    c.lang === "pt"
      ? "Transcreva exatamente o que é dito neste áudio em português do Brasil. Retorne somente o texto transcrito, sem comentários, sem aspas e sem formatação."
      : "Transcribe exactly what is said in this audio, in the language it was spoken. Return only the transcribed text, with no comments, quotes or formatting.";
  const g = await generate(STT_MODEL, {
    parts: [{ text: prompt }, { inline_data: { mime_type: "audio/wav", data: Buffer.from(wav).toString("base64") } }],
    temperature: 0,
  });
  const rate = Math.min(errorRate(c.text, g.text, c.unit), c.alt ? errorRate(c.alt, g.text, c.unit) : 1);
  const checks = { transcreveu: g.text.length > 0, erroAte15pct: rate <= 0.15 };
  return {
    feature: "stt", model: `${TTS_MODEL} -> ${STT_MODEL}`, caseId: c.id, checks, checkScore: score(checks),
    judgeScore: 5 * (1 - Math.min(rate, 1)), errorRate: rate,
    ms: g.ms, inputTokens: g.usage.inputTokens, outputTokens: g.usage.outputTokens, sample: g.text,
  };
}

type JobFn = () => Promise<Row>;
const jobs: Array<{ label: string; run: JobFn }> = [];
const TAG = option("tag", "");
const PROFILES = option("profiles", "").split(",").filter(Boolean);
const LANG_FILTER = option("langs", "").split(",").filter(Boolean);
const LITE = "gemini-3.1-flash-lite";
const PREV = "gemini-3-flash-preview";
const PRO = "gemini-3.1-pro-preview";
const V = (label: string, model: string, extra: { thinkingLevel?: string; maxTokens?: number } = {}): Variant => ({ label, spec: { model, thinkingLevel: extra.thinkingLevel, maxTokens: extra.maxTokens ?? MAX_TOKENS } });
const cfg = { useJudge: USE_JUDGE, judgeModel: JUDGE_MODEL };

/** Modelo por rota em cada branch (main usa Flash-Lite nos utilitários; dev usa Flash-preview). */
const PROFILE_SPEC: Record<string, { main: string; dev: string }> = {
  cards: { main: `${LITE}:max=3000`, dev: `${PREV}:max=3000` },
  note: { main: `${LITE}:max=3000`, dev: `${PREV}:max=3000` },
  translate: { main: `${LITE}:max=4096`, dev: `${PREV}:max=4096` },
  video: { main: `${LITE}:max=1500`, dev: `${PREV}:max=1500` },
  mindmap: { main: `${LITE}:max=8192`, dev: `${PREV}:max=8192` },
  prazos: { main: `${LITE}:max=2048`, dev: `${PREV}:max=2048` },
  chat: { main: `${PREV}:low:max=1024`, dev: `${PREV}:low:max=1024` },
};

const classic = {
  translate: [TRANSLATE_CASES, evalTranslate],
  video: [VIDEO_CASES, evalVideo],
  mindmap: [MINDMAP_CASES, evalMindmap],
  prazos: [PRAZOS_CASES, evalPrazos],
  chat: [CHAT_CASES, evalChat],
} as const;

/** Lista de [rótulo, spec] a executar para uma funcionalidade clássica. */
function modelsFor(feature: string): Array<[string, string]> {
  const prof = PROFILE_SPEC[feature];
  if (PROFILES.length && prof) {
    const same = prof.main === prof.dev;
    return same ? [["main=dev", prof.main]] : PROFILES.map((p) => [p, prof[p as "main" | "dev"]] as [string, string]);
  }
  return MODELS.map((m) => [m, m] as [string, string]);
}

for (const feature of FEATURES) {
  if (feature === "cards") for (const [label, spec] of modelsFor(feature)) for (const c of CARD_CASES) jobs.push({ label: `cards/${label}/${c.id}`, run: async () => ({ ...(await evalCards(spec, c)), model: label }) });
  if (feature === "note") for (const [label, spec] of modelsFor(feature)) for (const c of NOTE_CASES) jobs.push({ label: `note/${label}/${c.id}`, run: async () => ({ ...(await evalNote(spec, c)), model: label }) });
  const ex = classic[feature as keyof typeof classic];
  if (ex) {
    for (const [label, spec] of modelsFor(feature)) {
      for (const c of ex[0] as ReadonlyArray<{ id: string }>) {
        jobs.push({ label: `${feature}/${label}/${c.id}`, run: () => (ex[1] as (o: unknown, c: unknown) => Promise<Row>)({ spec: parseSpec(spec), label, ...cfg }, c) });
      }
    }
  }
  if (feature === "stt") for (const c of STT_CASES) jobs.push({ label: `stt/${c.id}`, run: () => evalStt(c) });
  if (feature === "vision") {
    const both = [V("main=dev (preview)", PREV), V("alt lite", LITE)];
    jobs.push(...visionJobs(cfg, { ocr: both, cards: both, pilot: [V("main (pro)", PRO, { thinkingLevel: "medium", maxTokens: 32000 }), V("dev (preview)", PREV, { thinkingLevel: "medium", maxTokens: 32000 })], pdf: [V("main=dev (preview low)", PREV, { thinkingLevel: "low" }), V("alt lite", LITE)] }) as never);
  }
  if (feature === "audio") jobs.push(...(audioJobs([V("main=dev (preview)", PREV), V("alt lite", LITE)]) as never));
  if (feature === "langs") {
    jobs.push(...(langJobs(cfg, {
      cards: flag("only-lang-stt") ? [] : [V("main (lite)", LITE), V("dev (preview)", PREV)],
      translate: flag("only-lang-stt") ? [] : [V("main (lite)", LITE, { maxTokens: 4096 }), V("dev (preview)", PREV, { maxTokens: 4096 })],
      chat: flag("only-lang-stt") ? [] : [V("main=dev (preview low)", PREV, { thinkingLevel: "low" }), V("alt lite", LITE, { thinkingLevel: "low" })],
      stt: flag("no-lang-stt") ? [] : [V("main=dev (preview)", PREV), V("alt lite", LITE)],
    }, LANG_FILTER) as never));
  }
  if (feature === "match") jobs.push(...(matchJobs(cfg, LANG_FILTER) as never));
  if (feature === "chatfull") jobs.push(...(chatFullJobs(cfg, [V("main=dev (preview low)", PREV, { thinkingLevel: "low" }), V("alt lite", LITE, { thinkingLevel: "low" })]) as never));
}
const RETRY_FROM = option("retry-from", "");
let baseRows: Row[] = [];
if (RETRY_FROM) {
  const prev = JSON.parse(readFileSync(RETRY_FROM, "utf8")) as { rows: Row[] };
  const failed = new Set(prev.rows.filter((r) => r.error).map((r) => `${r.feature}/${r.model}/${r.caseId}`));
  baseRows = prev.rows.filter((r) => !r.error);
  const keep = jobs.filter((j) => failed.has(j.label));
  jobs.length = 0;
  jobs.push(...keep);
  console.log(`Reexecutando ${jobs.length} casos com erro; ${baseRows.length} resultados mantidos.`);
}

if (flag("dry-run")) {
  const per = USE_JUDGE ? 2 : 1;
  const estimate = jobs.reduce((n, j) => n + (j.label.startsWith("stt") ? 2 : per), 0);
  console.log(`${jobs.length} casos, ~${estimate} chamadas.\n` + jobs.map((j) => j.label).join("\n"));
  process.exit(0);
}

if (!process.env["GEMINI_API_KEY"]) {
  console.error("GEMINI_API_KEY não definida nesta sessão.");
  process.exit(2);
}
setCallLimit(Number(option("max-calls", "1600")));
const rows: Row[] = [...baseRows];
function savePartial() {
  if (rows.length % 10 !== 0) return;
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(new URL(`partial-${TAG || "run"}.json`, REPORTS), JSON.stringify({ tag: TAG, partial: true, rows }));
}
const CONCURRENCY = Number(option("concurrency", "4"));
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++]!;
      try {
        const row = await job.run();
        rows.push(row);
        savePartial();
        console.log(`ok   ${job.label}  checks=${row.checkScore.toFixed(2)} nota=${row.judgeScore?.toFixed(2) ?? "-"} ${row.ms}ms`);
      } catch (error) {
        const [feature, ...rest] = job.label.split("/");
        rows.push({ feature: feature!, model: rest.slice(0, -1).join("/") || rest[0]!, caseId: rest.at(-1)!, checks: {}, checkScore: 0, ms: 0, inputTokens: 0, outputTokens: 0, error: String(error) });
        savePartial();
        console.log(`FAIL ${job.label}  ${String(error).slice(0, 160)}`);
      }
    }
  }),
);

type Summary = { feature: string; model: string; cases: number; failures: number; checks: number; nota: number | null; langOk: number | null; avgMs: number; tokens: number };
const groups = new Map<string, Row[]>();
for (const r of rows) groups.set(`${r.feature}|${r.model}`, [...(groups.get(`${r.feature}|${r.model}`) ?? []), r]);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const summary: Summary[] = [...groups.entries()].map(([key, rs]) => {
  const [feature, model] = key.split("|") as [string, string];
  const judged = rs.map((r) => r.judgeScore).filter((x): x is number => x !== undefined);
  const langs = rs.filter((r) => r.judge).map((r) => (r.judge!.output_language_correct ? 1 : 0));
  return {
    feature, model, cases: rs.length, failures: rs.filter((r) => r.error).length,
    checks: +mean(rs.map((r) => r.checkScore)).toFixed(2),
    nota: judged.length ? +mean(judged).toFixed(2) : null,
    langOk: langs.length ? +mean(langs).toFixed(2) : null,
    avgMs: Math.round(mean(rs.map((r) => r.ms))),
    tokens: Math.round(mean(rs.map((r) => r.inputTokens + r.outputTokens))),
  };
}).sort((a, b) => a.feature.localeCompare(b.feature) || a.model.localeCompare(b.model));

console.log("\nResumo (nota 1-5; checks 0-1; langOk 0-1; tokens médios por caso)");
console.table(summary);
console.log(`Chamadas: ${callCount()}`);

mkdirSync(REPORTS, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(new URL(`${TAG ? TAG + "-" : ""}${stamp}.json`, REPORTS), JSON.stringify({ tag: TAG, judge: JUDGE_MODEL, summary, rows }, null, 2));

if (flag("save-baseline")) {
  if (summary.some((s) => s.failures > 0)) {
    console.error("Há casos com erro; baseline não gravado.");
    process.exit(1);
  }
  writeFileSync(BASELINE, JSON.stringify({ savedAt: new Date().toISOString(), summary }, null, 2) + "\n");
  console.log("Baseline gravado.");
}

if (flag("check")) {
  if (!existsSync(BASELINE)) throw new Error("Sem baseline. Rode com --save-baseline primeiro.");
  const base = (JSON.parse(readFileSync(BASELINE, "utf8")) as { summary: Summary[] }).summary;
  let failed = false;
  for (const s of summary) {
    const b = base.find((x) => x.feature === s.feature && x.model === s.model);
    if (!b) continue;
    const drops: string[] = [];
    if (s.nota !== null && b.nota !== null && s.nota < b.nota - TOLERANCE) drops.push(`nota ${b.nota} -> ${s.nota}`);
    if (s.checks < b.checks - 0.1) drops.push(`checks ${b.checks} -> ${s.checks}`);
    if (s.failures > b.failures) drops.push(`falhas ${b.failures} -> ${s.failures}`);
    if (drops.length) {
      failed = true;
      console.log(`REGRESSÃO ${s.feature}/${s.model}: ${drops.join(", ")}`);
    }
  }
  console.log(failed ? "Reprovado." : "Sem regressões.");
  process.exit(failed ? 1 : 0);
}
