/**
 * Geração de texto e imagem pelo PilotAI para o blog.
 * Modelo de texto: gemini-3.1-flash-lite direto na API do Google AI Studio (menor custo).
 * Imagem: lovable/image-fast via endpoint de imagem do gateway (mantido).
 */
import {
  hasSameBlogHtmlStructure,
  hasStandardBlogEditorialStructure,
  normalizeBlogBodyHtml,
} from "@/lib/blog-content";

import { logAiFallback } from "./ai-fallback-log.server";
import { GEMINI_CHAT_URL, geminiHeaders, geminiModel } from "./gemini-api.server";

const GATEWAY_CHAT = GEMINI_CHAT_URL;
const GATEWAY_IMAGE = "https://ai.gateway.lovable.dev/v1/images/generations";
const TEXT_MODEL = geminiModel("google/gemini-3.1-flash-lite");
const TRANSLATION_RETRIES = 2;

export type GeneratedPost = {
  title: string;
  excerpt: string;
  body_html: string;
};

import { BLOG_LANGS } from "@/lib/blog-langs";
export const LANG_NAMES: Record<string, string> = Object.fromEntries(BLOG_LANGS.map((l) => [l.code, l.name]));

export async function generateBlogPostText(topic: string, sourceLang = "pt"): Promise<GeneratedPost> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("PilotAI indisponível agora.");

  const sourceName = LANG_NAMES[sourceLang] ?? "English";

  const system = [
    "You are a skilled blog writer for FlashPilot, a flashcard and study app.",
    `Write engaging, captivating blog posts in ${sourceName}.`,
    "Apply the same editorial style regardless of language: begin with a concise lead paragraph, develop the topic in at least 3 clearly titled sections, and end with a practical takeaway or call to action.",
    "Use short, readable paragraphs (usually 2-4 sentences). Use bullet or numbered lists for steps, examples, or grouped advice instead of turning them into long prose.",
    "Use bold sparingly for key terms. Keep headings concise and descriptive, and make each section add a distinct idea.",
    "Never return one long paragraph, a sequence of unstructured line breaks, or plain text without semantic headings and paragraphs.",
    "Use HTML formatting: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>.",
    "Do NOT include <h1> — the title is separate.",
    "Do NOT include <script>, <iframe>, or inline styles.",
    "Do NOT include markdown — use pure HTML.",
    "Return a JSON object with three fields: title (string), excerpt (1-2 sentence summary), body_html (the full HTML content).",
    "Return ONLY the JSON, no other text.",
  ].join(" ");

  const user = `Write an attractive blog post in ${sourceName} about: ${topic}`;

  const resp = await fetch(GATEWAY_CHAT, {
    method: "POST",
    headers: geminiHeaders(apiKey),
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`PilotAI erro ${resp.status}: ${text.slice(0, 200)}`);
  }

  const json = await resp.json();
  const choice = json.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new Error("O PilotAI atingiu o limite de tamanho do post. Reduza o escopo e tente novamente.");
  }
  const content = choice?.message?.content ?? "";

  let parsed: { title?: unknown; excerpt?: unknown; body_html?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("O PilotAI retornou um formato inválido. Gere o texto novamente.");
  }

  const bodyHtml = normalizeBlogBodyHtml(String(parsed.body_html ?? ""));
  if (!hasStandardBlogEditorialStructure(bodyHtml)) {
    throw new Error("O texto gerado não seguiu o padrão editorial do blog. Gere novamente.");
  }
  return {
    title: String(parsed.title ?? topic),
    excerpt: String(parsed.excerpt ?? ""),
    body_html: bodyHtml,
  };
}

export async function translatePostText(
  title: string,
  excerpt: string,
  bodyHtml: string,
  targetLang: string,
  sourceLang = "pt",
): Promise<{ title: string; excerpt: string; body_html: string }> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("PilotAI indisponível agora.");

  const target = LANG_NAMES[targetLang] ?? targetLang;
  const source = LANG_NAMES[sourceLang] ?? sourceLang;

  const system = [
    `You translate blog content from ${source} to ${target}.`,
    "Translate naturally and fluently, as if originally written by a native speaker.",
    "Preserve the exact HTML structure and hierarchy of the source.",
    "Keep every paragraph, heading, list, list item, quote, and inline formatting element in the same order; only translate text inside elements.",
    "Never turn headings into paragraphs, merge or split paragraphs, convert lists into prose, or add, remove, reorder, or change HTML tags or attributes.",
    "Return a JSON object: { title, excerpt, body_html } with translated values.",
    "Return ONLY the JSON.",
  ].join(" ");

  const user = JSON.stringify({ title, excerpt, body_html: bodyHtml });

  const resp = await fetch(GATEWAY_CHAT, {
    method: "POST",
    headers: geminiHeaders(apiKey),
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) throw new Error(`Tradução PilotAI erro ${resp.status}`);

  const json = await resp.json();
  const choice = json.choices?.[0];
  if (choice?.finish_reason === "length") {
    throw new Error("A tradução atingiu o limite de tamanho. Reduza o conteúdo e tente novamente.");
  }
  const content = choice?.message?.content ?? "";
  const parsed = JSON.parse(content);
  const translatedBody = normalizeBlogBodyHtml(String(parsed.body_html ?? bodyHtml));
  if (!hasSameBlogHtmlStructure(bodyHtml, translatedBody)) {
    throw new Error("A tradução alterou a estrutura do artigo. Revise o texto-base e tente traduzir novamente.");
  }
  return {
    title: String(parsed.title ?? title),
    excerpt: String(parsed.excerpt ?? excerpt),
    body_html: translatedBody,
  };
}

export type BatchTranslation = {
  lang: string;
  title: string;
  excerpt: string;
  body_html: string;
};

/** Traduz o post do idioma base para todos os demais idiomas suportados.
 * As chamadas são sequenciais para evitar que o gateway rejeite o lote por
 * excesso de requisições simultâneas.
 */
export async function translateAllLanguages(
  title: string,
  excerpt: string,
  bodyHtml: string,
  sourceLang: string,
): Promise<{ results: BatchTranslation[]; failed: string[] }> {
  const targets = Object.keys(LANG_NAMES).filter((l) => l !== sourceLang);
  const results: BatchTranslation[] = [];
  const failed: string[] = [];
  for (const lang of targets) {
    let translated: BatchTranslation | null = null;
    for (let attempt = 0; attempt < TRANSLATION_RETRIES; attempt++) {
      try {
        const t = await translatePostText(title, excerpt, bodyHtml, lang, sourceLang);
        translated = { lang, ...t };
        break;
      } catch (error) {
        if (attempt === TRANSLATION_RETRIES - 1) {
          console.error(`[blog-translation] ${lang} failed after ${TRANSLATION_RETRIES} attempts`, error);
        } else {
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
      }
    }
    if (translated) results.push(translated);
    else failed.push(lang);
  }
  return { results, failed };
}

const COVER_BUCKET = "blog-covers";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

/** Guarda os bytes da capa no storage e devolve uma URL assinada de longa duração. */
export async function storeCoverBytes(bytes: Uint8Array, contentType = "image/png"): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ext = contentType.includes("jpeg")
    ? "jpg"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("gif")
        ? "gif"
        : "png";
  const path = `covers/${crypto.randomUUID()}.${ext}`;
  const up = await supabaseAdmin.storage.from(COVER_BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (up.error) throw up.error;
  const signed = await supabaseAdmin.storage.from(COVER_BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signed.error) throw signed.error;
  return signed.data.signedUrl;
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

function coverPrompt(topic: string): string {
  return `A beautiful, eye-catching blog cover image about: ${topic}. Modern, clean, professional style with warm tones. No text.`;
}

/** Google AI Studio direto (GEMINI_API_KEY). Retorna null se indisponível/erro. */
async function generateCoverViaGemini(topic: string): Promise<string | null> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) return null;
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: coverPrompt(topic) }] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9" } },
        }),
      },
    );
    if (!resp.ok) {
      console.warn(`[blog-cover] Gemini ${resp.status}; usando gateway.`);
      return null;
    }
    const json = await resp.json();
    const parts: Array<{ inlineData?: { mimeType?: string; data?: string } }> =
      json.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data)?.inlineData;
    if (!img?.data) return null;
    return await storeCoverBytes(b64ToBytes(img.data), img.mimeType ?? "image/png");
  } catch (e) {
    console.warn("[blog-cover] Gemini falhou; usando gateway.", e);
    return null;
  }
}

export async function generateCoverImage(topic: string): Promise<string> {
  const viaGemini = await generateCoverViaGemini(topic);
  if (viaGemini) return viaGemini;
  await logAiFallback("blog-cover", GEMINI_IMAGE_MODEL, "lovable/image-fast", "falha");

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("PilotAI indisponível agora.");


  const resp = await fetch(GATEWAY_IMAGE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "lovable/image-fast",
      prompt: `A beautiful, eye-catching blog cover image about: ${topic}. Modern, clean, professional style with warm tones. No text.`,
      n: 1,
      size: "1024x576",
      response_format: "url",
    }),
  });

  if (!resp.ok) throw new Error(`Imagem PilotAI erro ${resp.status}`);

  const json = await resp.json();
  const first = json.data?.[0] ?? {};
  if (first.b64_json) {
    return storeCoverBytes(b64ToBytes(String(first.b64_json)), "image/png");
  }
  if (first.url) {
    // A URL do gateway pode expirar: copiamos a imagem para o storage do projeto.
    const img = await fetch(String(first.url));
    if (img.ok) {
      const buf = new Uint8Array(await img.arrayBuffer());
      const ct = img.headers.get("content-type") ?? "image/png";
      return storeCoverBytes(buf, ct);
    }
    return String(first.url);
  }
  throw new Error("Imagem PilotAI não retornou conteúdo.");
}
