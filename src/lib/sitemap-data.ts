import { createClient } from "@supabase/supabase-js";
import { findBlogLang } from "@/lib/blog-langs";
import { isValidBlogSlug } from "@/lib/blog-slug";

export const SITEMAP_BASE = "https://flashpilot.net";
/** Somente páginas públicas: nada de rotas logadas, admin ou /bulkdemo. */
export const PUBLIC_PAGES = ["/", "/auth", "/blog", "/termos", "/privacidade", "/reembolso"];

export const xmlResponse = (xml: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type SitemapPost = { slug: string; published_at: string | null; langs: string[] };

/** Posts publicados com as traduções realmente salvas. Lança erro em falha (nunca XML parcial). */
export async function loadBlogPosts(): Promise<SitemapPost[]> {
  const sb = publicClient();
  const cutoff = new Date().toISOString();
  const posts: { id: string; slug: string; published_at: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("blog_posts")
      .select("id, slug, published_at")
      .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${cutoff})`)
      .order("published_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    posts.push(...(data ?? []).filter((p) => isValidBlogSlug(p.slug)));
    if (!data || data.length < 1000) break;
  }
  const langs = new Map<string, string[]>();
  const ids = posts.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await sb
      .from("blog_post_translations")
      .select("post_id, lang, title")
      .in("post_id", ids.slice(i, i + 200));
    if (error) throw error;
    for (const t of data ?? []) {
      if (!t.title?.trim() || !findBlogLang(t.lang)) continue;
      langs.set(t.post_id, [...(langs.get(t.post_id) ?? []), t.lang]);
    }
  }
  return posts.map((p) => ({ slug: p.slug, published_at: p.published_at, langs: langs.get(p.id) ?? [] }));
}

const hl = (l: string) => (l === "pt" ? "pt-BR" : l);

export function blogUrlEntry(p: SitemapPost, lang: string): string {
  if (!isValidBlogSlug(p.slug)) return "";
  const slug = encodeURIComponent(p.slug);
  const def = p.langs.includes("en") ? "en" : p.langs.includes("pt") ? "pt" : p.langs[0];
  const alts = p.langs
    .map((l) => `<xhtml:link rel="alternate" hreflang="${hl(l)}" href="${SITEMAP_BASE}/${l}/blog/${slug}"/>`)
    .concat(def ? [`<xhtml:link rel="alternate" hreflang="x-default" href="${SITEMAP_BASE}/${def}/blog/${slug}"/>`] : [])
    .join("");
  const lm = p.published_at ? `<lastmod>${p.published_at.slice(0, 10)}</lastmod>` : "";
  return `<url><loc>${SITEMAP_BASE}/${lang}/blog/${slug}</loc>${lm}${alts}</url>`;
}
