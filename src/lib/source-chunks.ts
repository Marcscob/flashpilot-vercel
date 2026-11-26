/** Ordered input chunking for long sources (books, handouts, laws, web pages). SSR-safe. */
export const SOURCE_CHUNK_CHARS = 20_000;
export const SOURCE_MAX_CHUNKS = 180;

/** Splits text in source order, preferring paragraph/sentence boundaries. */
export function splitSourceChunks(text: string, size = SOURCE_CHUNK_CHARS): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n\n", size);
    if (cut < size * 0.5) cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.5) cut = rest.lastIndexOf(". ", size);
    if (cut < size * 0.5) cut = size;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trimStart();
  }
  if (rest.trim()) chunks.push(rest.trim());
  return chunks;
}

/** Distributes the requested total across chunks (at least 1 each), preserving order. */
export function distributeCards(total: number, chunks: number): number[] {
  if (chunks <= 0) return [];
  const base = Math.floor(total / chunks);
  const extra = total % chunks;
  return Array.from({ length: chunks }, (_, i) => Math.max(1, base + (i < extra ? 1 : 0)));
}

const ART_RE = (n: number) =>
  new RegExp(`(?:^|\\n)\\s*Art(?:igo)?\\.?\\s*${n}(?![0-9])\\s*(?:º|°|o)?(?:\\s*-\\s*[A-Z])?[\\s.\\-–]`, "i");

/**
 * When the student asks for an article range ("art 1 até art 50", "arts. 121 a 154"),
 * narrows the source to that range so huge codes are not sent whole. Returns the
 * original text when no range is recognized or found.
 */
export function focusSourceRange(text: string, focus: string): string {
  const m = /art(?:igos?|s?)?\.?\s*(\d{1,4})\s*(?:º|°|o)?\s*(?:a|at[eé]|-|–|ao|to|until|hasta)\s*(?:o\s*)?(?:art(?:igos?|s?)?\.?\s*)?(\d{1,4})/i.exec(
    focus,
  );
  if (!m) return text;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (!(from >= 1 && to >= from)) return text;
  const start = ART_RE(from).exec(text);
  if (!start) return text;
  const after = text.slice(start.index);
  let end = after.length;
  for (let n = to + 1; n <= to + 5; n++) {
    const next = ART_RE(n).exec(after.slice(1));
    if (next) {
      end = next.index + 1;
      break;
    }
  }
  return after.slice(0, end).trim();
}
