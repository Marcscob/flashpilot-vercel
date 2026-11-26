import { sanitizeNoteHtml } from "@/lib/sanitize-html";

/** Detecta se o texto do card contém tags HTML (ex.: <i>, <em>, <b>). */
export function hasHtmlTags(text: string): boolean {
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(text);
}

/** Sanitiza o HTML do card antes de renderizar (remove scripts e eventos). */
export function sanitizeCardHtml(text: string): string {
  return sanitizeNoteHtml(text);
}

/** Remove as tags para narração/tradução (lê só o texto puro). */
export function stripHtmlTags(text: string): string {
  return text.replace(/<\/?[a-z][a-z0-9]*(\s[^>]*)?>/gi, "");
}
