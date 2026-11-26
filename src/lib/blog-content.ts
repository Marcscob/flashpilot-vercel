/** Convert editor/PilotAI plain text into readable paragraphs without changing HTML. */
export function normalizeBlogBodyHtml(body: string): string {
  const value = body.trim();
  if (!value) return "";
  if (/<\/?[a-z][^>]*>/i.test(value)) return value;

  const escapeHtml = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`)
    .join("\n");
}

/** Return the ordered HTML element structure, ignoring translated text/attributes. */
export function getBlogHtmlStructure(html: string): string[] {
  return Array.from(html.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi), ([tag, name]) => {
    const closing = tag.startsWith("</");
    return `${closing ? "/" : ""}${name?.toLowerCase() ?? ""}`;
  });
}

export function hasSameBlogHtmlStructure(sourceHtml: string, translatedHtml: string): boolean {
  // Só a estrutura de blocos importa; negrito/itálico podem mudar de posição na tradução.
  const BLOCK = new Set(["h2", "h3", "h4", "p", "ul", "ol", "li", "blockquote", "table", "tr", "td", "th"]);
  const blocks = (html: string) => getBlogHtmlStructure(html).filter((t) => BLOCK.has(t.replace("/", "")));
  const sourceStructure = blocks(sourceHtml);
  const translatedStructure = blocks(translatedHtml);
  return sourceStructure.length === translatedStructure.length
    && sourceStructure.every((tag, index) => tag === translatedStructure[index]);
}

export function hasStandardBlogEditorialStructure(html: string): boolean {
  const tags = getBlogHtmlStructure(html).filter((tag) => !tag.startsWith("/"));
  const paragraphCount = tags.filter((tag) => tag === "p").length;
  const sectionHeadingCount = tags.filter((tag) => tag === "h2" || tag === "h3").length;
  return paragraphCount >= 3 && sectionHeadingCount >= 3;
}
