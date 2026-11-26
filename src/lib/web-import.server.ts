import { fetchLightChat } from "./gemini-api.server";
import { DESTINATION_NAMING_RULES } from "./card-guidelines";
import { cleanName, isGenericName } from "./destination-names";
import { parseJsonLenient } from "./json-repair";
import { readWebPage } from "./web-page.server";
import { validateWebPageUrl } from "./web-page-text";

export const WEB_IMPORT_LIMITS = { subpagesPerPage: 3, hubItems: 8, imagesPerPage: 3, imageMaxBytes: 2_000_000 };

export type WebImportTree = {
  subjects: Array<{ id: string; name: string }>;
  topics: Array<{ id: string; name: string; subject_id: string; parent_id: string | null }>;
};

export type WebImportPage = {
  url: string;
  title: string;
  text: string;
  subject: string;
  topic: string;
  /** "hub": página-índice da matéria; cada item de `subpages` é um ASSUNTO (em `subtopic`). */
  kind: "hub" | "article";
  subpages: Array<{ url: string; subtopic: string }>;
  images: string[];
};

function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code === "pt" ? "pt-BR" : code) ?? code;
  } catch {
    return code;
  }
}

function treeOutline(tree: WebImportTree): string {
  const lines: string[] = [];
  for (const subject of tree.subjects.slice(0, 150)) {
    lines.push(`- ${subject.name}`);
    const roots = tree.topics.filter((t) => t.subject_id === subject.id && !t.parent_id).slice(0, 30);
    for (const root of roots) {
      lines.push(`  - ${root.name}`);
      for (const child of tree.topics.filter((t) => t.parent_id === root.id).slice(0, 15))
        lines.push(`    - ${child.name}`);
    }
  }
  return lines.join("\n") || "(vazia)";
}

type Raw = {
  pages?: Array<{
    url?: unknown;
    kind?: unknown;
    subject?: unknown;
    topic?: unknown;
    subpages?: Array<{ url?: unknown; subtopic?: unknown }>;
    images?: unknown[];
  }>;
};

/**
 * Lê as páginas e pede a uma única chamada de IA o destino (matéria, assunto), as subpáginas
 * que valem a pena e as imagens didáticas. Só aceita URLs que a própria página oferece.
 */
export async function planWebImport(input: {
  urls: string[];
  lang: string;
  tree: WebImportTree;
}): Promise<{ pages: WebImportPage[]; failed: number; firstError: string | null }> {
  const loaded: Array<Awaited<ReturnType<typeof readWebPage>>> = [];
  let failed = 0;
  let firstError: string | null = null;
  for (const url of input.urls) {
    try {
      loaded.push(await readWebPage(url));
    } catch (error) {
      failed += 1;
      firstError ??= error instanceof Error ? error.message : "WEB_FETCH_FAILED";
    }
  }
  if (!loaded.length) return { pages: [], failed, firstError };

  const digest = loaded.map((page) => ({
    url: page.url,
    title: page.title,
    headings: page.headings.slice(0, 25),
    start: page.text.slice(0, 500),
    links: page.links.map((l) => ({ url: l.url, label: l.label })),
    images: page.images.map((i) => ({ url: i.url, alt: i.alt })),
  }));

  let raw: Raw | undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Timeout")), 30_000);
  try {
    const response = await fetchLightChat(
      {
        model: "google/gemini-3.1-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você cataloga páginas da web para criar flashcards, em lote.
Árvore ATUAL do aluno (matéria > assunto > tópico):
${treeOutline(input.tree)}

Regras:
- Páginas do mesmo site e área costumam ser ASSUNTOS da mesma matéria (ex.: matéria "Biologia"; assuntos "Genética", "Ecologia"). Use UMA matéria para o lote quando fizer sentido.
- REUSE exatamente o nome de matéria e de assunto da árvore atual quando houver equivalente. Só crie nome novo se nada servir.
${DESTINATION_NAMING_RULES}
- "kind": "hub" quando a página é um ÍNDICE de uma matéria (lista de conteúdos/assuntos como botões ou cards, ex.: página "Matemática" listando Geometria analítica, Trigonometria, Logaritmo, Binômio de Newton). Caso contrário "article".
- Em "hub": "subject" é a matéria (o próprio tema do índice) e "topic" fica vazio; cada item de "subpages" é um ASSUNTO dessa matéria (até ${WEB_IMPORT_LIMITS.hubItems} links, os mais centrais, em ordem lógica), com "subtopic" = nome do assunto. Escolha só links de conteúdo da própria matéria; ignore jogos, notícias, vestibular e outras matérias.
- Em "article": "subpages": até ${WEB_IMPORT_LIMITS.subpagesPerPage} links da lista "links" da página que sejam capítulos ou aprofundamentos reais do assunto (ex.: leis de Mendel dentro de Genética), em ordem lógica do básico ao avançado. Ignore termos soltos, glossário, notícias, autores e outras matérias. "subtopic" é o nome curto do capítulo.
- "images": até ${WEB_IMPORT_LIMITS.imagesPerPage} URLs da lista "images" cujo conteúdo o texto não substitui, em QUALQUER área: diagramas e esquemas (anatomia, biologia, química), fórmulas e equações em imagem, figuras geométricas, gráficos, circuitos e diagramas de forças (física), tabelas, mapas, fluxogramas, tabelas periódicas. Ignore fotos decorativas, banners e anúncios.
- Use SOMENTE URLs presentes nas listas. Escreva nomes em ${languageName(input.lang)} (${input.lang}). Matéria até 5 palavras, assunto até 8.
Devolva APENAS JSON: {"pages":[{"url":"...","kind":"article","subject":"...","topic":"...","subpages":[{"url":"...","subtopic":"..."}],"images":["..."]}]}`,
          },
          { role: "user", content: JSON.stringify(digest) },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 1200 * Math.max(1, loaded.length),
      },
      controller.signal,
      "web-import-plan",
    );
    if (response.ok) {
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      raw = parseJsonLenient(json.choices?.[0]?.message?.content ?? "") as Raw | undefined;
    }
  } catch {
    raw = undefined;
  } finally {
    clearTimeout(timer);
  }

  const pages = loaded.map((page): WebImportPage => {
    const hit = raw?.pages?.find((p) => p?.url === page.url) ?? raw?.pages?.[loaded.indexOf(page)];
    const subject = isGenericName(hit?.subject) ? "" : cleanName(hit?.subject) ?? "";
    const topic = isGenericName(hit?.topic) ? "" : cleanName(hit?.topic) ?? "";
    const allowedLinks = new Set(page.links.map((l) => l.url));
    const allowedImages = new Set(page.images.map((i) => i.url));
    const seen = new Set<string>();
    const kind = hit?.kind === "hub" ? "hub" : "article";
    const subpages = (hit?.subpages ?? [])
      .filter((s): s is { url: string; subtopic: string } => typeof s?.url === "string" && allowedLinks.has(s.url))
      .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
      .slice(0, kind === "hub" ? WEB_IMPORT_LIMITS.hubItems : WEB_IMPORT_LIMITS.subpagesPerPage)
      .map((s) => ({ url: s.url, subtopic: cleanName(s.subtopic) || page.links.find((l) => l.url === s.url)?.label || "" }));
    const images = (hit?.images ?? [])
      .filter((u): u is string => typeof u === "string" && allowedImages.has(u))
      .slice(0, WEB_IMPORT_LIMITS.imagesPerPage);
    return {
      url: page.url,
      title: page.title,
      text: page.text,
      kind: kind === "hub" && subpages.length ? "hub" : "article",
      subject,
      topic: topic || cleanName(page.title.split(/[:|–-]/)[0]) || "",
      subpages,
      images,
    };
  });
  return { pages, failed, firstError };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Baixa uma imagem pública (png, jpeg ou webp, até 2 MB) revalidando cada redirecionamento. */
export async function readWebImage(rawUrl: string): Promise<string | null> {
  try {
    let current = validateWebPageUrl(rawUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      for (let hop = 0; hop <= 3; hop++) {
        const response = await fetch(current.href, {
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; FlashPilotBot/1.0; +https://flashpilot.app)" },
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) return null;
          current = validateWebPageUrl(new URL(location, current).href);
          continue;
        }
        const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
        if (!response.ok || !/^image\/(png|jpeg|webp)$/.test(type)) return null;
        if (Number(response.headers.get("content-length") ?? 0) > WEB_IMPORT_LIMITS.imageMaxBytes) return null;
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > WEB_IMPORT_LIMITS.imageMaxBytes || bytes.length < 2_000) return null;
        return `data:${type};base64,${toBase64(bytes)}`;
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
