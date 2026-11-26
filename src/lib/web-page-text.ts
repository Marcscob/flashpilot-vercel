export const WEB_PAGE_LIMITS = { maxBytes: 8_000_000, timeoutMs: 20_000, maxChars: 1_500_000 };

const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp", ".intranet"];

/** Aceita só http(s) público por nome de domínio; recusa IPs, portas e hosts internos. */
export function validateWebPageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("WEB_INVALID_URL");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const isIp = host.startsWith("[") || /^[\d.]+$/.test(host) || /^0x[\da-f]+$/i.test(host);
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "80" && url.port !== "443") ||
    isIp ||
    !host.includes(".") ||
    host === "localhost" ||
    BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    throw new Error("WEB_INVALID_URL");
  }
  return url;
}

export function isValidWebPageUrl(raw: string): boolean {
  try {
    validateWebPageUrl(raw);
    return true;
  } catch {
    return false;
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  ccedil: "ç", Ccedil: "Ç", atilde: "ã", Atilde: "Ã", otilde: "õ", Otilde: "Õ",
  aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í",
  oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú", acirc: "â", Acirc: "Â",
  ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô", agrave: "à", Agrave: "À",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", ouml: "ö", Ouml: "Ö", auml: "ä",
  Auml: "Ä", szlig: "ß", egrave: "è", ograve: "ò", ugrave: "ù", copy: "©", deg: "°",
  middot: "·", bull: "•", euro: "€", pound: "£", times: "×", frac12: "½",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[\da-f]+|[a-z][a-z\d]*);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = body[1]!.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

const stripTags = (html: string) => html.replace(/<[^>]*>/g, " ");
const squash = (value: string) => decodeEntities(stripTags(value)).replace(/\s+/g, " ").trim();

/** Converte cada <table> em linhas "Coluna: valor | Coluna: valor", de dentro para fora. */
function tablesToText(html: string): string {
  const innermost = /<table\b[^>]*>((?:(?!<table\b)[\s\S])*?)<\/table>/i;
  let out = html;
  for (let guard = 0; guard < 200 && innermost.test(out); guard++) {
    out = out.replace(innermost, (_all, body: string) => {
      const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
        [...row[1]!.matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((cell) => ({
          head: cell[1]!.toLowerCase() === "th",
          text: squash(cell[2]!),
        })),
      ).filter((cells) => cells.some((cell) => cell.text));
      if (!rows.length) return "\n";
      const headers = rows[0]!.every((cell) => cell.head) && rows.length > 1 ? rows.shift()! : null;
      const lines = rows.map((cells) =>
        cells
          .map((cell, index) => {
            const label = headers?.[index]?.text;
            return label && cell.text ? `${label}: ${cell.text}` : cell.text;
          })
          .filter(Boolean)
          .join(" | "),
      );
      return `\n${lines.join("\n")}\n`;
    });
  }
  return out;
}

function pickTitle(html: string): string {
  const meta =
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(html)?.[1];
  const title = meta ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  return squash(title ?? "").slice(0, 120);
}

function pickContainer(html: string): string {
  const articles = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map((m) => m[1]!);
  const best = articles.sort((a, b) => b.length - a.length)[0];
  if (best && squash(best).length > 500) return best;
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1];
  if (main && squash(main).length > 500) return main;
  return /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
}

export type WebPageLink = { url: string; label: string };
export type WebPageImage = { url: string; alt: string };

const AD_IMAGE = /(logo|banner|icon|avatar|sprite|pixel|publicidade|advert|ads?[-_/]|tracking|badge|button|thumb-?small)/i;

/** Links internos e imagens candidatas do texto principal; a IA decide quais usar. */
export function extractWebPageStructure(
  html: string,
  pageUrl: string,
): { headings: string[]; links: WebPageLink[]; images: WebPageImage[] } {
  const body = pickContainer(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template|iframe|canvas|nav|footer|aside|form|button|select|dialog|head)\b[\s\S]*?<\/\1>/gi, " "),
  );
  const page = new URL(pageUrl);
  const headings = [...body.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((m) => squash(m[1]!))
    .filter((h) => h && !/^t[óo]picos deste artigo$/i.test(h))
    .slice(0, 40);

  const links = new Map<string, string>();
  for (const m of body.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let target: URL;
    try {
      target = new URL(decodeEntities(m[1]!), page);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(target.protocol) || target.hostname !== page.hostname) continue;
    target.search = "";
    target.hash = "";
    if (target.pathname === page.pathname || target.pathname === "/") continue;
    const label = squash(m[2]!).slice(0, 80);
    if (label.length < 3 || links.has(target.href)) continue;
    links.set(target.href, label);
  }

  const images = new Map<string, string>();
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const attr = (name: string) => new RegExp(`\\s${name}=["']([^"']*)["']`, "i").exec(tag)?.[1] ?? "";
    const src = attr("data-src") || attr("data-lazy-src") || attr("src");
    if (!src || src.startsWith("data:")) continue;
    let target: URL;
    try {
      target = new URL(decodeEntities(src), page);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(target.protocol) || /\.(svg|gif)(\?|$)/i.test(target.pathname)) continue;
    if (AD_IMAGE.test(target.pathname)) continue;
    const width = Number(attr("width"));
    if (width && width < 100) continue;
    if (!images.has(target.href)) images.set(target.href, squash(decodeEntities(attr("alt"))).slice(0, 160));
  }

  return {
    headings,
    links: [...links].slice(0, 80).map(([url, label]) => ({ url, label })),
    images: [...images].slice(0, 16).map(([url, alt]) => ({ url, alt })),
  };
}

/** Extrai o texto principal de uma página, sem menus, anúncios e rodapés, e mantém tabelas legíveis. */
export function extractWebPageText(html: string, fallbackTitle = ""): { title: string; text: string } {
  const title = pickTitle(html) || fallbackTitle;
  let body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|canvas|nav|footer|aside|form|button|select|dialog|head)\b[\s\S]*?<\/\1>/gi, " ");
  body = pickContainer(body);
  body = tablesToText(body)
    .replace(/<\/?(p|div|section|article|header|ul|ol|blockquote|pre|figure|figcaption|dl|dt|dd|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = decodeEntities(stripTags(body))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, WEB_PAGE_LIMITS.maxChars);
  if ((text.match(/\p{L}/gu) ?? []).length < 120) throw new Error("WEB_NO_CONTENT");
  return { title, text };
}
