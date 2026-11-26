import {
  extractWebPageStructure,
  extractWebPageText,
  validateWebPageUrl,
  WEB_PAGE_LIMITS,
  type WebPageImage,
  type WebPageLink,
} from "./web-page-text";

const MAX_REDIRECTS = 4;

function decodeBody(bytes: Uint8Array, contentType: string): string {
  const header = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  const sniff = /<meta[^>]+charset=["']?([\w-]+)/i.exec(
    new TextDecoder("latin1").decode(bytes.subarray(0, 4096)),
  )?.[1];
  for (const label of [header, sniff]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      continue;
    }
  }
  // No declared charset: strict UTF-8, else Windows-1252 (legacy pages such as planalto.gov.br).
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function readLimited(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > WEB_PAGE_LIMITS.maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(Math.min(total, WEB_PAGE_LIMITS.maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const room = out.length - offset;
    if (room <= 0) break;
    out.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.byteLength, room);
  }
  return out;
}

/**
 * Baixa uma página pública e devolve o texto principal. Cada redirecionamento é
 * revalidado e só endereços públicos http(s) são aceitos.
 */
export async function readWebPage(rawUrl: string): Promise<{
  url: string;
  title: string;
  text: string;
  headings: string[];
  links: WebPageLink[];
  images: WebPageImage[];
}> {
  let current = validateWebPageUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEB_PAGE_LIMITS.timeoutMs);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      let response: Response;
      try {
        response = await fetch(current.href, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; FlashPilotBot/1.0; +https://flashpilot.app)",
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7",
          },
        });
      } catch {
        throw new Error("WEB_FETCH_FAILED");
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("WEB_FETCH_FAILED");
        current = validateWebPageUrl(new URL(location, current).href);
        continue;
      }
      if (!response.ok) throw new Error("WEB_FETCH_FAILED");
      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/(html|plain)|application\/xhtml/i.test(contentType)) throw new Error("WEB_NOT_HTML");
      const html = decodeBody(await readLimited(response), contentType);
      const page = extractWebPageText(html, current.hostname);
      return { url: current.href, ...page, ...extractWebPageStructure(html, current.href) };
    }
    throw new Error("WEB_FETCH_FAILED");
  } finally {
    clearTimeout(timer);
  }
}
