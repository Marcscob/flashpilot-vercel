import { decodeTextBytes } from "./decode-text";
// Leitura de planilhas (CSV/XLSX/XLS) no navegador — sem IA, sem custo.
export const SHEET_MAX_ROWS = 500;
export const SHEET_AI_MAX_CHARS = 30_000;

const HEAD_Q = ["pergunta", "question", "q", "front", "frente", "pregunta", "domanda", "frage"];
const HEAD_A = [
  "resposta",
  "answer",
  "a",
  "back",
  "verso",
  "respuesta",
  "réponse",
  "risposta",
  "antwort",
];

export type SheetData = { name: string; rows: string[][]; cols: number };

export async function readSheet(file: File): Promise<SheetData> {
  const XLSX = await import("@e965/xlsx");
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  const wb = isCsv
    ? XLSX.read(decodeTextBytes(buf), { type: "string" })
    : XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
  const rows = raw.map((r) => r.map((c) => String(c ?? "").trim())).filter((r) => r.some(Boolean));
  // Colunas efetivamente usadas (ignora colunas totalmente vazias).
  const used = new Set<number>();
  rows.forEach((r) => r.forEach((c, i) => c && used.add(i)));
  const idx = [...used].sort((a, b) => a - b);
  const compact = rows.map((r) => idx.map((i) => r[i] ?? ""));
  return { name: file.name, rows: compact, cols: idx.length };
}

export function sheetToCards(
  data: SheetData,
  localizedHeaders?: { q: string; a: string },
): { question: string; answer: string }[] {
  let rows = data.rows;
  if (rows.length) {
    const [a, b] = rows[0].map((x) => x.toLowerCase());
    const localizedQuestion = localizedHeaders?.q.trim().toLocaleLowerCase();
    const localizedAnswer = localizedHeaders?.a.trim().toLocaleLowerCase();
    const hasLocalizedHeaders = a === localizedQuestion && b === localizedAnswer;
    if (hasLocalizedHeaders || (HEAD_Q.includes(a ?? "") && HEAD_A.includes(b ?? "")))
      rows = rows.slice(1);
  }
  return rows
    .map(([q, a]) => ({ question: (q ?? "").trim(), answer: (a ?? "").trim() }))
    .filter((c) => c.question || c.answer);
}

export function sheetToText(data: SheetData): string {
  return data.rows.map((r) => r.join(" | ")).join("\n");
}

export async function downloadSheetTemplate(
  labels: { q: string; a: string; ex: [string, string][] },
  filename = "modelo-flashpilot.xlsx",
  sheetName = "Flashcards",
) {
  const XLSX = await import("@e965/xlsx");
  const ws = XLSX.utils.aoa_to_sheet([[labels.q, labels.a], ...labels.ex]);
  ws["!cols"] = [{ wch: 50 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
