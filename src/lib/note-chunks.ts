const DEFAULT_CHUNK_CHARS = 1800;
const BLOCK_TAGS = new Set([
  "p", "ul", "ol", "blockquote", "table", "h1", "h2", "h3", "h4", "h5", "h6", "figure",
]);
const VOID_TAGS = new Set(["img", "hr", "br"]);

function splitText(text: string, maxChars: number): string[] {
  const output: string[] = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars + 1);
    const sentence = Math.max(window.lastIndexOf(". "), window.lastIndexOf("; "), window.lastIndexOf("<br>"));
    const whitespace = window.search(/\s+\S*$/);
    const cut = sentence >= Math.floor(maxChars * 0.45)
      ? sentence + 1
      : whitespace >= Math.floor(maxChars * 0.45) ? whitespace : maxChars;
    output.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) output.push(remaining);
  return output;
}

function splitOversizedBlock(block: string, maxChars: number): string[] {
  const wrapper = /^<(p|h[1-6])\b([^>]*)>([\s\S]*)<\/\1>$/i.exec(block);
  if (wrapper) {
    const tag = wrapper[1];
    const attrs = wrapper[2] ?? "";
    const inner = wrapper[3] ?? "";
    const open = `<${tag}${attrs}>`;
    const close = `</${tag}>`;
    const allowance = Math.max(200, maxChars - open.length - close.length);
    return splitText(inner, allowance).map((part) => `${open}${part}${close}`);
  }

  const container = /^<(ul|ol|blockquote|figure)\b([^>]*)>([\s\S]*)<\/\1>$/i.exec(block);
  if (container) {
    const tag = container[1];
    const attrs = container[2] ?? "";
    const inner = container[3] ?? "";
    const open = `<${tag}${attrs}>`;
    const close = `</${tag}>`;
    const innerParts = splitNoteHtml(inner, Math.max(200, maxChars - open.length - close.length));
    if (innerParts.length > 1) return innerParts.map((part) => `${open}${part}${close}`);
  }

  const table = /^<table\b([^>]*)>([\s\S]*)<\/table>$/i.exec(block);
  if (table) {
    const attrs = table[1] ?? "";
    const inner = table[2] ?? "";
    const rows = inner.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi);
    if (rows && rows.length > 1) {
      const open = `<table${attrs}><tbody>`;
      const close = "</tbody></table>";
      const chunks: string[] = [];
      let current = "";
      for (const row of rows) {
        if (current && open.length + current.length + row.length + close.length > maxChars) {
          chunks.push(`${open}${current}${close}`);
          current = row;
        } else {
          current += row;
        }
      }
      if (current) chunks.push(`${open}${current}${close}`);
      return chunks;
    }
  }

  // Imagens e estruturas atômicas permanecem inteiras para não corromper o HTML.
  if (/^<(table|img)\b/i.test(block)) return [block];
  return splitText(block, maxChars);
}

/** Divide HTML em blocos de topo sem perder texto entre elementos nem partir estruturas. */
export function splitNoteHtml(html: string, maxChars = DEFAULT_CHUNK_CHARS): string[] {
  const source = html;
  if (!source.trim() || source.length <= maxChars) return source ? [source] : [];

  const blocks: string[] = [];
  const stack: string[] = [];
  const token = /<\/?([a-zA-Z][\w-]*)\b[^>]*>/g;
  let blockStart = 0;
  let match: RegExpExecArray | null;

  while ((match = token.exec(source)) !== null) {
    const matchedTag = match[1];
    if (!matchedTag) continue;
    const tag = matchedTag.toLowerCase();
    const closing = match[0].startsWith("</");
    const selfClosing = match[0].endsWith("/>") || VOID_TAGS.has(tag);

    if (!closing && !selfClosing && BLOCK_TAGS.has(tag)) stack.push(tag);
    if (closing && BLOCK_TAGS.has(tag)) {
      const index = stack.lastIndexOf(tag);
      if (index >= 0) stack.splice(index, 1);
    }

    if (stack.length === 0 && ((closing && BLOCK_TAGS.has(tag)) || selfClosing)) {
      const end = token.lastIndex;
      blocks.push(source.slice(blockStart, end));
      blockStart = end;
    }
  }
  if (blockStart < source.length) blocks.push(source.slice(blockStart));
  if (!blocks.length) blocks.push(source);

  const atomic = blocks.flatMap((block) => block.length > maxChars
    ? splitOversizedBlock(block, maxChars)
    : [block]);
  const chunks: string[] = [];
  let current = "";
  for (const block of atomic) {
    if (current && current.length + block.length > maxChars) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export const NOTE_FORMAT_CHUNK_CHARS = DEFAULT_CHUNK_CHARS;