/**
 * Tradução ao vivo de trechos do blog que faltam no banco para o idioma do leitor.
 * Só traduz campos vazios; o resultado é gravado para os próximos leitores.
 */
import { FALLBACK_LANG } from "./lang-match";
import { findBlogLang } from "./blog-langs";
import { GEMINI_CHAT_URL, geminiHeaders, geminiModel } from "./gemini-api.server";

const GATEWAY_URL = GEMINI_CHAT_URL;
const MODEL = geminiModel("google/gemini-3.1-flash-lite");


export function resolveBlogLang(lang: string | undefined | null): string {
  if (lang === "pt-BR") return "pt";
  return findBlogLang(lang) ? lang! : FALLBACK_LANG;
}

/** Variante regional → idioma de origem (para traduzir a partir dele). */
export function blogBaseLang(lang: string): string | undefined {
  return findBlogLang(lang)?.base;
}

type Fields = { title?: string; excerpt?: string; body_html?: string };

/** Traduz os campos informados para o idioma alvo. Devolve {} se falhar. */
export async function translateBlogFields(fields: Fields, target: string): Promise<Fields> {
  const entries = Object.entries(fields).filter(([, v]) => typeof v === "string" && v.trim());
  if (!entries.length) return {};
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return {};
  try {
    const resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: geminiHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `Translate every value of the JSON object into ${findBlogLang(target)?.name ?? target}. Keep the same keys. HTML values must keep exactly the same tags, attributes and structure; translate only visible text. Keep brand names (FlashPilot, PilotAI, FlashCoins). For a regional variant, adapt spelling, vocabulary and forms of address to that region. Return only the JSON object.`,
          },
          { role: "user", content: JSON.stringify(Object.fromEntries(entries)) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return {};
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (json.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Fields = {};
    for (const [k] of entries) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim()) out[k as keyof Fields] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Grava a tradução gerada (sem sobrescrever campos já existentes). */
export async function persistBlogTranslation(
  postId: string,
  lang: string,
  existing: { title?: string | null; excerpt?: string | null; body_html?: string | null } | null,
  translated: Fields,
): Promise<void> {
  if (!Object.keys(translated).length) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (existing) {
      const patch: Fields = {};
      if (!existing.title?.trim() && translated.title) patch.title = translated.title;
      if (!existing.excerpt?.trim() && translated.excerpt) patch.excerpt = translated.excerpt;
      if (!existing.body_html?.trim() && translated.body_html) patch.body_html = translated.body_html;
      if (!Object.keys(patch).length) return;
      await supabaseAdmin.from("blog_post_translations").update(patch).eq("post_id", postId).eq("lang", lang);
    } else if (translated.title) {
      await supabaseAdmin.from("blog_post_translations").insert({
        post_id: postId,
        lang,
        title: translated.title,
        excerpt: translated.excerpt ?? null,
        body_html: translated.body_html ?? "",
      });
    }
  } catch {
    // best-effort cache
  }
}
