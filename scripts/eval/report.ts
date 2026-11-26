/**
 * Consolida relatórios JSON de scripts/eval/reports em um relatório Markdown.
 *   bun scripts/eval/report.ts [tag ...]   (padrão: core media langs langstt, o relatório mais recente de cada)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

type Row = {
  feature: string; model: string; caseId: string; checks: Record<string, boolean>; checkScore: number;
  judge?: { output_language_correct: boolean; comment: string } | null; judgeScore?: number; errorRate?: number;
  ms: number; inputTokens: number; outputTokens: number; error?: string; sample?: string;
};

const dir = new URL("./reports/", import.meta.url);
const tags = process.argv.slice(2).length ? process.argv.slice(2) : ["core", "media", "langs", "langstt"];
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const rows: Row[] = [];
const used: string[] = [];
for (const tag of tags) {
  const latest = files.filter((f) => f.startsWith(`${tag}-`)).sort().at(-1);
  if (!latest) continue;
  used.push(latest);
  rows.push(...(JSON.parse(readFileSync(new URL(latest, dir), "utf8")) as { rows: Row[] }).rows);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const f = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "–");
const group = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
};
const stats = (rs: Row[]) => ({
  n: rs.length,
  erro: rs.filter((r) => r.error).length,
  checks: mean(rs.map((r) => r.checkScore)),
  nota: mean(rs.map((r) => r.judgeScore).filter((x): x is number => x !== undefined)),
  idioma: mean(rs.filter((r) => r.judge).map((r) => (r.judge!.output_language_correct ? 1 : 0))),
  ms: mean(rs.map((r) => r.ms)),
  tok: mean(rs.map((r) => r.inputTokens + r.outputTokens)),
  perfeitos: rs.filter((r) => !r.error && r.checkScore >= 1).length,
});
const flag = (s: ReturnType<typeof stats>) => (s.erro > 0 || s.checks < 0.9 || (Number.isFinite(s.nota) && s.nota < 4.3) ? "⚠️" : "✅");

const out: string[] = [];
out.push(`# Relatório de qualidade da IA do FlashPilot\n`);
out.push(`Gerado em ${new Date().toLocaleString("pt-BR")} · arquivos: ${used.join(", ")}\n`);
out.push(`Checks = fração das verificações automáticas aprovadas (0–1). Nota = média do juiz Gemini Pro (1–5) ou, quando indicado, 5×(1−taxa de erro). ✅ = checks ≥ 0,90 e nota ≥ 4,3; ⚠️ = abaixo disso ou com erro de execução.\n`);

const features = [...group(rows, (r) => r.feature).keys()].sort();
out.push(`## 1. Resumo por funcionalidade e variante\n`);
out.push(`| Funcionalidade | Variante | Casos | Perfeitos | Erros | Checks | Nota | Idioma OK | Tempo médio | Tokens | |`);
out.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
for (const feat of features) {
  const byModel = group(rows.filter((r) => r.feature === feat), (r) => r.model);
  for (const [model, rs] of [...byModel].sort()) {
    const s = stats(rs);
    out.push(`| ${feat} | ${model} | ${s.n} | ${s.perfeitos} | ${s.erro} | ${f(s.checks)} | ${f(s.nota)} | ${f(s.idioma)} | ${f(s.ms / 1000, 1)} s | ${Math.round(s.tok)} | ${flag(s)} |`);
  }
}

out.push(`\n## 2. Verificações que mais falham\n`);
const fails = new Map<string, { n: number; cases: Set<string> }>();
for (const r of rows) {
  if (r.error) {
    const k = `${r.feature} · ${r.model} · ERRO DE EXECUÇÃO`;
    const e = fails.get(k) ?? { n: 0, cases: new Set() };
    e.n++; e.cases.add(r.caseId); fails.set(k, e);
  }
  for (const [check, ok] of Object.entries(r.checks)) {
    if (ok) continue;
    const k = `${r.feature} · ${r.model} · ${check}`;
    const e = fails.get(k) ?? { n: 0, cases: new Set() };
    e.n++; e.cases.add(r.caseId); fails.set(k, e);
  }
}
out.push(`| Falha | Ocorrências | Casos (até 12) |`);
out.push(`|---|---|---|`);
for (const [k, v] of [...fails].sort((a, b) => b[1].n - a[1].n).slice(0, 60)) out.push(`| ${k} | ${v.n} | ${[...v.cases].slice(0, 12).join(", ")} |`);

out.push(`\n## 3. main × dev (mesmas funcionalidades, modelo de cada branch)\n`);
out.push(`| Funcionalidade | main (checks / nota / ms) | dev (checks / nota / ms) | Melhor |`);
out.push(`|---|---|---|---|`);
const cmp = (feat: string, a: (m: string) => boolean, b: (m: string) => boolean, nameA = "main", nameB = "dev") => {
  const ra = rows.filter((r) => r.feature === feat && a(r.model));
  const rb = rows.filter((r) => r.feature === feat && b(r.model));
  if (!ra.length || !rb.length) return;
  const sa = stats(ra), sb = stats(rb);
  const score = (s: ReturnType<typeof stats>) => s.checks + (Number.isFinite(s.nota) ? s.nota / 5 : 0);
  const best = Math.abs(score(sa) - score(sb)) < 0.03 ? "empate" : score(sa) > score(sb) ? nameA : nameB;
  out.push(`| ${feat} | ${f(sa.checks)} / ${f(sa.nota)} / ${Math.round(sa.ms)} | ${f(sb.checks)} / ${f(sb.nota)} / ${Math.round(sb.ms)} | ${best} |`);
};
for (const feat of ["cards", "note", "translate", "video", "mindmap", "prazos"]) cmp(feat, (m) => m === "main", (m) => m === "dev");
cmp("vision-imagepilot", (m) => m.startsWith("main"), (m) => m.startsWith("dev"));
cmp("lang-cards", (m) => m.startsWith("main"), (m) => m.startsWith("dev"));
cmp("lang-translate", (m) => m.startsWith("main"), (m) => m.startsWith("dev"));

out.push(`\n## 4. Idiomas (cards, tradução, chat e voz)\n`);
out.push(`Cada célula: checks / nota (– quando não há juiz). ⚠️ marca checks < 1 ou nota < 4,3 ou erro.\n`);
const langFeatures = ["lang-cards", "lang-translate", "lang-chat", "lang-stt"];
const variants = langFeatures.map((ft) => [...new Set(rows.filter((r) => r.feature === ft).map((r) => r.model))].sort().map((m) => ({ ft, m })));
const cols = variants.flat();
const langs = [...new Set(rows.filter((r) => r.feature.startsWith("lang-")).map((r) => r.caseId))];
if (cols.length) {
  out.push(`| Idioma | ${cols.map((c) => `${c.ft.replace("lang-", "")}: ${c.m}`).join(" | ")} |`);
  out.push(`|---|${cols.map(() => "---").join("|")}|`);
  for (const l of langs) {
    const cells = cols.map((c) => {
      const r = rows.find((x) => x.feature === c.ft && x.model === c.m && x.caseId === l);
      if (!r) return "";
      const bad = r.error || r.checkScore < 1 || (r.judgeScore !== undefined && r.judgeScore < 4.3);
      return `${bad ? "⚠️ " : ""}${r.error ? "ERRO" : f(r.checkScore, 1)}${r.judgeScore !== undefined ? ` / ${f(r.judgeScore, 1)}` : ""}`;
    });
    out.push(`| ${l} | ${cells.join(" | ")} |`);
  }
  const problem = new Map<string, string[]>();
  for (const r of rows.filter((x) => x.feature.startsWith("lang-"))) {
    const bad = Object.entries(r.checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (!bad.length && !r.error) continue;
    const k = `${r.feature} · ${r.model}`;
    problem.set(k, [...(problem.get(k) ?? []), `${r.caseId} (${r.error ? "erro" : bad.join("+")})`]);
  }
  out.push(`\n### Idiomas com problema por variante\n`);
  for (const [k, v] of problem) {
    if (v.length > 12) {
      const kinds = new Map<string, number>();
      for (const item of v) for (const c of (/\((.*)\)$/.exec(item)?.[1] ?? "").split("+")) kinds.set(c, (kinds.get(c) ?? 0) + 1);
      out.push(`- **${k}**: ${v.length} de ${langs.length} idiomas com falha (${[...kinds].map(([c, n]) => `${c}: ${n}`).join(", ")})`);
    } else out.push(`- **${k}**: ${v.join(", ")}`);
  }
}

out.push(`\n## 5. Visão\n`);
const ocr = rows.filter((r) => r.feature === "vision-ocr");
if (ocr.length) {
  out.push(`### OCR (extração de texto da imagem): taxa de erro por imagem\n`);
  const models = [...new Set(ocr.map((r) => r.model))].sort();
  out.push(`| Imagem | ${models.join(" | ")} |`);
  out.push(`|---|${models.map(() => "---").join("|")}|`);
  for (const id of [...new Set(ocr.map((r) => r.caseId))]) {
    out.push(`| ${id} | ${models.map((m) => { const r = ocr.find((x) => x.model === m && x.caseId === id); return r ? (r.error ? "ERRO" : `${((r.errorRate ?? 0) * 100).toFixed(0)}%`) : ""; }).join(" | ")} |`);
  }
}
for (const r of rows.filter((x) => x.feature === "vision-imagepilot")) out.push(`\n- ImagePilot · ${r.model} · ${r.caseId}: ${(r.sample ?? "").split("\n")[0]}`);

out.push(`\n## 6. Áudio\n`);
for (const r of rows.filter((x) => x.feature.startsWith("audio-"))) out.push(`- ${r.feature} · ${r.model} · ${r.caseId}: checks ${f(r.checkScore)}${r.errorRate !== undefined ? ` · erro ${(r.errorRate * 100).toFixed(0)}%` : ""} · "${(r.sample ?? "").slice(0, 90).replace(/\n/g, " ")}"`);

out.push(`\n## 7. Casos com problema (amostra)\n`);
const worst = rows
  .filter((r) => r.error || r.checkScore < 1 || (r.judgeScore !== undefined && r.judgeScore < 4))
  .sort((a, b) => a.checkScore - b.checkScore)
  .slice(0, 60);
for (const r of worst) {
  const bad = Object.entries(r.checks).filter(([, ok]) => !ok).map(([k]) => k).join(", ");
  out.push(`- **${r.feature} · ${r.model} · ${r.caseId}** — ${r.error ? `erro: ${r.error.slice(0, 140)}` : `falhou: ${bad || "nota baixa"}`}${r.judge?.comment ? ` · juiz: ${r.judge.comment.slice(0, 140)}` : ""}`);
}

writeFileSync(new URL("./RELATORIO.md", dir), out.join("\n") + "\n");
console.log(`RELATORIO.md gerado com ${rows.length} linhas.`);
