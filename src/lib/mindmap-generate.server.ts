/**
 * Geração da estrutura de um mapa mental a partir de um texto-fonte
 * (anotação ou flashcards escolhidos).
 *
 * O PilotAI devolve apenas a árvore de tópicos; o desenho da imagem é feito no
 * cliente (src/lib/mindmap-render.ts), garantindo texto sempre legível.
 * Mesma rota e mesmo modelo já usados pela conversação e pela tradução.
 */
import { parseJsonLenient } from "./json-repair";
import { LANGUAGE_CHAT_MODEL, languageNameFor, stripMarkup } from "./language-chat.server";

import { fetchLightChat, hasLightChatProvider } from "./gemini-api.server";

export type MindMapDetail = "short" | "normal" | "deep";

export type MindMapNode = { label: string; children?: MindMapNode[] };
export type MindMapTree = { title: string; lang: string; nodes: MindMapNode[] };

const BUDGET: Record<MindMapDetail, { branches: string; total: number }> = {
  short: { branches: "3 to 5 main branches, each with up to 3 sub-items", total: 18 },
  normal: { branches: "4 to 7 main branches, each with up to 5 sub-items", total: 34 },
  deep: {
    branches: "6 to 9 main branches, each with up to 6 sub-items and short third-level items",
    total: 60,
  },
};

function cleanLabel(value: unknown): string {
  const text = stripMarkup(String(value ?? ""))
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 90);
}

function normalizeNodes(
  raw: unknown,
  depth: number,
  budget: { count: number; max: number },
): MindMapNode[] {
  if (!Array.isArray(raw) || depth > 3) return [];
  const out: MindMapNode[] = [];
  for (const item of raw) {
    if (budget.count >= budget.max) break;
    const source = item as { label?: unknown; title?: unknown; name?: unknown; children?: unknown };
    const label = cleanLabel(source?.label ?? source?.title ?? source?.name ?? item);
    if (!label) continue;
    budget.count += 1;
    const children = normalizeNodes(source?.children, depth + 1, budget);
    out.push(children.length ? { label, children } : { label });
  }
  return out;
}

function parseJson(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return parseJsonLenient(trimmed) ?? null;
}

export async function generateMindMapTree(
  input: {
    source: string;
    title: string;
    lang?: string | null;
    detail: MindMapDetail;
  },
  signal?: AbortSignal,
): Promise<MindMapTree> {
  if (!hasLightChatProvider()) throw new Error("Geração de mapa mental indisponível agora.");

  const lang = input.lang && !input.lang.startsWith("pt") ? input.lang : "pt-BR";
  const langName = languageNameFor(lang);
  const budget = BUDGET[input.detail] ?? BUDGET.normal;

  const system = [
    `You turn study material into a mind map outline written entirely in ${langName}.`,
    `Structure: one short central title, then ${budget.branches}.`,
    "Labels are short: 2 to 7 words, no full sentences, no numbering, no trailing punctuation.",
    "Group related ideas under the same branch; keep the logical order of the source.",
    "Plain text only: never use asterisks, underscores, backticks or markdown.",
    'Answer with JSON only, exactly this shape: {"title":"...","nodes":[{"label":"...","children":[{"label":"..."}]}]}',
  ].join(" ");

  const user = [
    `Suggested title: ${input.title || "(none)"}`,
    "Source material:",
    input.source.slice(0, 24000),
  ].join("\n");

  const resp = await fetchLightChat(
    {
      model: LANGUAGE_CHAT_MODEL,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    signal,
    "mindmap",
  );

  if (!resp.ok) {
    if (resp.status === 429)
      throw new Error("Muitas gerações seguidas. Tente novamente em alguns segundos.");
    if (resp.status === 402 || resp.status === 403)
      throw new Error("Créditos do PilotAI esgotados para gerar o mapa mental.");
    throw new Error("Não consegui gerar o mapa mental agora. Tente novamente.");
  }

  const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = parseJson(json.choices?.[0]?.message?.content ?? "") as {
    title?: unknown;
    nodes?: unknown;
  } | null;
  if (!parsed) throw new Error("Não consegui gerar o mapa mental agora. Tente novamente.");

  const counter = { count: 0, max: budget.total };
  const nodes = normalizeNodes(parsed.nodes, 1, counter);
  if (!nodes.length)
    throw new Error("Não encontrei conteúdo suficiente para montar o mapa mental.");

  return {
    title: cleanLabel(parsed.title) || input.title || "Mapa mental",
    lang,
    nodes,
  };
}
