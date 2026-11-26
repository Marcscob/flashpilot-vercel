import DOMPurify from "dompurify";

/**
 * Segurança: todo HTML de anotação passa por aqui antes de ir ao DOM.
 * Remove scripts, eventos inline e URLs executáveis, preservando a formatação.
 */
export function sanitizeNoteHtml(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof window === "undefined") {
    // No servidor não há DOM: remove os blocos executáveis mais perigosos.
    return html
      .replace(/<\s*(script|iframe|object|embed|style)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  }
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
