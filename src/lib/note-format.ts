/**
 * Padrão único das anotações: sans-serif 12px, sem negrito.
 * Normaliza o HTML salvo removendo negrito, títulos e estilos de fonte.
 */
export function normalizeNoteHtml(html: string): string {
  if (!html) return html;
  let out = html;

  // remove negrito de <strong>/<b> inline, mas preserva parágrafos com classe note-h1/2/3
  // (o negrito dos títulos vem da classe CSS, não de <strong>)
  out = out.replace(/<\/?(strong|b)(\s[^>]*)?>/gi, "");

  // títulos HTML viram parágrafos (preserva classe se houver)
  out = out.replace(/<h[1-6](\s[^>]*)?>/gi, (_m, attrs) => `<p${attrs ?? ""}>`);
  out = out.replace(/<\/h[1-6]>/gi, "</p>");

  // remove declarações de fonte dentro de style="...", mas preserva font-size
  // (tamanho aplicado a trechos selecionados pelo usuário)
  out = out.replace(/style="([^"]*)"/gi, (_m, css: string) => {
    const cleaned = css
      .split(";")
      .filter((d) => !/^\s*(font-family|font-weight|font)\s*:/i.test(d))
      .map((d) => d.trim())
      .filter(Boolean)
      .join("; ");
    return cleaned ? `style="${cleaned}"` : "";
  });


  // remove classes desconhecidas, mas preserva note-h1/2/3 e note-img/note-table
  out = out.replace(/class="([^"]*)"/gi, (_m, cls: string) => {
    const kept = cls
      .split(/\s+/)
      .filter((c) => /^note-(h[123]|img|table)$/.test(c))
      .join(" ");
    return kept ? `class="${kept}"` : "";
  });

  return out;
}

/** Tags permitidas no HTML gerado pelo PilotAI formatadora (padrão apostila). */
const ALLOWED_TAGS = new Set([
  "p", "span", "ul", "ol", "li", "blockquote", "table", "thead", "tbody",
  "tr", "th", "td", "img", "hr", "br", "em", "u", "i",
]);

/**
 * Limpa o HTML devolvido pelo PilotAI: remove tags fora da whitelist (mantendo o
 * texto interno), converte h1..h6 em títulos inline e normaliza classes/estilos.
 */
export function sanitizeApostilaHtml(html: string): string {
  if (!html) return "";
  let out = html;

  // remove blocos perigosos por completo
  out = out.replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "");

  // h1..h6 -> parágrafo com título inline
  out = out.replace(/<h([1-6])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, _a, inner: string) => {
    const n = Math.min(3, Number(lvl));
    return `<p><span class="note-h${n}">${inner}</span></p>`;
  });

  // negrito -> remove (o padrão do app não usa <strong>)
  out = out.replace(/<\/?(strong|b)(\s[^>]*)?>/gi, "");

  // remove tags não permitidas, preservando o conteúdo
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)\/?>/g, (m, tag: string) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? m : "";
  });

  // remove atributos indesejados (mantém class permitidas, src/alt de imagens)
  out = out.replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s[^>]*)?)>/g, (_m, tag: string, attrs: string) => {
    const lower = tag.toLowerCase();
    const keep: string[] = [];
    if (lower === "img") {
      const src = /\ssrc\s*=\s*"([^"]*)"/i.exec(attrs)?.[1];
      if (!src || /^javascript:/i.test(src)) return "";
      keep.push(`src="${src}"`);
      keep.push('class="note-img"');
    } else {
      const cls = /\sclass\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "";
      const classes = cls.split(/\s+/).filter((c) => /^note-(h[123]|img|table)$/.test(c));
      if (lower === "table") classes.push("note-table");
      const kept = Array.from(new Set(classes)).join(" ");
      if (kept) keep.push(`class="${kept}"`);
    }

    const uniq = Array.from(new Set(keep));
    return `<${lower}${uniq.length ? " " + uniq.join(" ") : ""}>`;
  });

  return out.trim();
}

