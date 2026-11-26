/**
 * Browser-safe parser for legislation texts (laws, codes, regulations).
 * Rule: subject = law title; for each run of articles, the heading right above
 * the articles is the topic (tópico) and the heading right above that is the
 * subject area (assunto). Higher headings in between are ignored.
 */
export type LegalUnit = { topic: string; subtopic?: string; text: string };
export type LegalSplit = { subject: string; units: LegalUnit[] };

const LEVELS: [RegExp, number][] = [
  [/^(PARTE)\s+[\wÀ-ú]+/i, 0],
  [/^(LIVRO)\s+[\wÀ-ú]+/i, 1],
  [/^(T[IÍ]TULO)\s+[\wÀ-ú]+/i, 2],
  [/^(CAP[IÍ]TULO)\s+[\wÀ-ú]+/i, 3],
  [/^(SE[CÇ][AÃ]O)\s+[\wÀ-ú]+/i, 4],
  [/^(SUBSE[CÇ][AÃ]O)\s+[\wÀ-ú]+/i, 5],
];
const ARTICLE = /^Art(igo)?\.?\s*\d+/i;
const BODY = /^(§|Par[aá]grafo|[IVXLC]+\s*[-–]|[a-z]\)|\d+\))/;
const SMALL = new Set(["da", "de", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "na", "no", "nas", "nos", "para", "por", "com", "ao", "aos", "à", "às"]);

function levelOf(line: string): number | null {
  for (const [re, lvl] of LEVELS) if (re.test(line) && line.length <= 40) return lvl;
  return null;
}
/** Editorial noise in uppercase: (VETADO), (REVOGADO), footnotes, "NOTA", "VIDE", amendment references. */
const NOISE = [
  /^[([].*[)\]][.;,:]?$/,
  /^\[.*\]\.?$/,
  /\b(VETAD[OA]S?|REVOGAD[OA]S?|REVOGA[CÇ][AÃ]O)\b/i,
  /^(\*|\d+\s*[-–).]|NOTAS?\b|NR\b|VIDE\b|OBS\.?\b|OBSERVA[CÇ][AÃ]O)/i,
  /\b(REDA[CÇ][AÃ]O DADA|INCLU[IÍ]D[OA]|ACRESCID[OA]|ALTERAD[OA]|RENUMERAD[OA]|REGULAMENTO|VIG[EÊ]NCIA)\b/i,
  /^(DECRETA|PROMULGA|RESOLVE|DETERMINA|ESTABELECE|ORDENA)\s*:?$/i,
  /^(O|A)\s+(PRESIDENT[EA]|GOVERNADOR[A]?|PREFEIT[OA]|CONGRESSO|MINISTR[OA])\b/i,
  /FA[CÇ]O SABER/i,
  /\b(LEI|DECRETO|MEDIDA PROVIS[OÓ]RIA|EMENDA)\s*(N[º°O.]|COMPLEMENTAR)/i,
];
export function isEditorialNoise(line: string): boolean {
  return NOISE.some((re) => re.test(line.trim()));
}
function isHeading(line: string): boolean {
  if (isEditorialNoise(line)) return false;
  if (line.length > 160 || ARTICLE.test(line) || BODY.test(line)) return false;
  const letters = line.replace(/[^A-Za-zÀ-ú]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}
export function prettyHeading(s: string): string {
  const words = s.trim().replace(/\s+/g, " ").toLowerCase().split(" ");
  return words
    .map((w, i) => (/^[ivxlc]+$/i.test(w) && w.length <= 5 && i > 0 ? w.toUpperCase() : i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .slice(0, 120);
}

const TITLE = /^(LEI|DECRETO(-LEI)?|MEDIDA PROVIS[OÓ]RIA|RESOLU[CÇ][AÃ]O|PORTARIA|INSTRU[CÇ][AÃ]O NORMATIVA|EMENDA CONSTITUCIONAL|LEI COMPLEMENTAR)\b.*\bN[º°O.]/i;
const EMENTA = /^(Disp[õo]e|Regulamenta|Institui|Altera|Estabelece|Aprova|Define|Cria|Promulga|Consolida|Dá nova reda|Organiza|Trata)\b/i;
function shortEmenta(s: string): string {
  let t = s.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
  // "Aprova a Consolidação das Leis do Trabalho" -> the approved norm is the subject.
  const approved = t.match(/^Aprova\s+(?:a|o|as|os)\s+(.+)$/i);
  if (approved) t = approved[1]!;
  t = t.split(/[,;]\s+(e\s+)?d[áa] outras provid[êe]ncias/i)[0]!;
  if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, "") + "…";
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function prettyTitle(s: string): string {
  const t = s.replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  return (t.charAt(0) + t.slice(1).toLowerCase()).replace(/\bn[º°o.]\s*/i, "nº ").slice(0, 110);
}

export function splitLegalText(text: string, fallbackSubject = ""): LegalSplit | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.filter((l) => ARTICLE.test(l)).length < 3) return null;
  let subject = "";
  // Law title and ementa (object of the norm) before the first article give the subject name.
  const firstArt = lines.findIndex((l) => ARTICLE.test(l));
  const preamble = lines.slice(0, firstArt);
  const titleLine = preamble.find((l) => TITLE.test(l));
  const ementa = preamble.find((l) => EMENTA.test(l) && l !== l.toUpperCase());
  if (ementa) subject = shortEmenta(ementa);
  else if (titleLine) subject = prettyTitle(titleLine);
  const stack: { level: number; name: string }[] = [];
  let pendingLevel: number | null = null;
  const units: LegalUnit[] = [];
  let current: LegalUnit | null = null;
  for (const line of lines) {
    if (ARTICLE.test(line) || (current && !isHeading(line) && levelOf(line) === null)) {
      if (!ARTICLE.test(line) && !current) continue;
      const names = stack.map((s) => s.name);
      const top = names[names.length - 1];
      const below = names[names.length - 2];
      const dest = top === undefined ? { topic: subject || fallbackSubject } : below === undefined ? { topic: top } : { topic: below, subtopic: top };
      if (!current || current.topic !== dest.topic || current.subtopic !== dest.subtopic) {
        current = { ...dest, text: "" };
        units.push(current);
      }
      current.text += (current.text ? "\n\n" : "") + line;
      continue;
    }
    const lvl = levelOf(line);
    if (lvl !== null) { pendingLevel = lvl; continue; }
    if (!isHeading(line)) continue;
    if (!subject && pendingLevel === null && !stack.length && !units.length) { subject = prettyHeading(line); continue; }
    const level = pendingLevel ?? 6;
    pendingLevel = null;
    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    stack.push({ level, name: prettyHeading(line) });
    current = null;
  }
  const finalSubject = subject || fallbackSubject;
  if (!units.length || !finalSubject) return null;
  return { subject: finalSubject, units: units.map((u) => (u.subtopic ? u : { topic: u.topic, text: u.text })) };
}
