// Fase 5 — divisão de textos longos em blocos para narração contínua.
// Um texto curto continua sendo um único bloco: o comportamento atual do app
// (uma única fala) permanece idêntico.

/** Tamanho alvo de cada bloco, em caracteres. */
export const SPEECH_CHUNK_TARGET = 220;
/** Limite duro: acima disso o bloco é quebrado mesmo sem pontuação. */
export const SPEECH_CHUNK_MAX = 300;

function hardSplit(piece: string, max: number): string[] {
  const words = piece.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const w of words) {
    if (!buf) {
      buf = w;
    } else if (buf.length + 1 + w.length <= max) {
      buf = `${buf} ${w}`;
    } else {
      out.push(buf);
      buf = w;
    }
    // Palavra isolada maior que o limite: corta em pedaços do tamanho máximo.
    while (buf.length > max) {
      out.push(buf.slice(0, max));
      buf = buf.slice(max);
    }
  }
  if (buf) out.push(buf);
  return out;
}

function splitParagraph(paragraph: string, target: number, max: number): string[] {
  const sentences = paragraph
    .split(/(?<=[.!?…:;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const pieces: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= max) {
      pieces.push(sentence);
      continue;
    }
    // Frase muito longa: tenta vírgulas antes de quebrar por palavras.
    const parts = sentence.split(/(?<=,)\s+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.length <= max) pieces.push(part);
      else pieces.push(...hardSplit(part, max));
    }
  }

  // Junta pedaços pequenos até o tamanho alvo, para evitar fala picada.
  const out: string[] = [];
  let buf = "";
  for (const piece of pieces) {
    if (!buf) buf = piece;
    else if (buf.length + 1 + piece.length <= target) buf = `${buf} ${piece}`;
    else { out.push(buf); buf = piece; }
  }
  if (buf) out.push(buf);
  return out;
}

/**
 * Divide o texto em blocos na ordem de leitura. Retorna `[]` para texto vazio
 * e um único bloco (o próprio texto normalizado) quando ele é curto.
 */
export function splitTextForSpeech(
  text: string,
  opts?: { target?: number; max?: number },
): string[] {
  const target = opts?.target ?? SPEECH_CHUNK_TARGET;
  const max = opts?.max ?? opts?.target ?? SPEECH_CHUNK_MAX;
  const clean = (text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= max && !/\n\s*\n/.test(clean)) {
    return [clean.replace(/\s+/g, " ")];
  }

  const paragraphs = clean.split(/\n\s*\n+/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= max) chunks.push(paragraph);
    else chunks.push(...splitParagraph(paragraph, target, max));
  }
  return chunks.filter(Boolean);
}
