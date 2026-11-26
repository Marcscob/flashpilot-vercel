import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "@/lib/app-manager";
import { FACEBOOK_PAGES, blogPostCanonicalUrl, buildFacebookMessage, type FacebookPageKey } from "@/lib/blog-facebook";

const GRAPH_API_VERSION = "v21.0";

function assertAdmin(claims: unknown) {
  if (!isAppManagerIdentity(claims)) throw new Error("Área restrita ao AppManager.");
}

type TranslationRow = { lang: string; title: string; excerpt: string | null };

export type FacebookPreview = {
  key: FacebookPageKey;
  pageName: string;
  /** Idioma do blog que será usado no texto, ou null se não houver conteúdo. */
  lang: string | null;
  message: string;
  excerpt: string | null;
  url: string;
  coverUrl: string | null;
  /** A página tem access token configurado no servidor. */
  configured: boolean;
  /** Há texto (resumo ou título) para publicar. */
  hasContent: boolean;
};

/** Escolhe a tradução que melhor atende a página (idioma exato, depois variante-base, depois inglês, depois qualquer uma com texto). */
function pickTranslation(translations: TranslationRow[], preferredLangs: string[]): TranslationRow | null {
  const withText = translations.filter((t) => (t.excerpt ?? "").trim() || t.title.trim());
  if (!withText.length) return null;
  for (const lang of preferredLangs) {
    const exact = withText.find((t) => t.lang === lang);
    if (exact) return exact;
  }
  // Variantes da página aceitam o idioma-base (ex.: es-AR usa "es").
  for (const lang of preferredLangs) {
    const base = lang.split("-")[0];
    const baseRow = withText.find((t) => t.lang === base || t.lang.split("-")[0] === base);
    if (baseRow) return baseRow;
  }
  return withText.find((t) => t.lang === "en") ?? withText[0]!;
}

async function loadPostAndTranslations(postId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: post, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id, slug, cover_image_url, status")
    .eq("id", postId)
    .single();
  if (error) throw error;
  if (!post) throw new Error("Post não encontrado.");

  const { data: translations, error: translationsError } = await supabaseAdmin
    .from("blog_post_translations")
    .select("lang, title, excerpt")
    .eq("post_id", postId);
  if (translationsError) throw translationsError;

  return { post, translations: (translations ?? []) as TranslationRow[] };
}

function buildPreviews(
  post: { slug: string; cover_image_url: string | null },
  translations: TranslationRow[],
): FacebookPreview[] {
  return FACEBOOK_PAGES.map((page) => {
    const chosen = pickTranslation(translations, page.langs);
    const lang = chosen?.lang ?? null;
    return {
      key: page.key,
      pageName: page.pageName,
      lang,
      message: chosen ? buildFacebookMessage(chosen.excerpt, chosen.title) : "",
      excerpt: chosen?.excerpt ?? null,
      url: blogPostCanonicalUrl(lang ?? page.langs[0]!, post.slug),
      coverUrl: post.cover_image_url,
      configured: Boolean(process.env[page.tokenEnv]),
      hasContent: Boolean(chosen),
    };
  });
}

/* ---------- prévia das publicações por página ---------- */
export const adminFacebookPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { post, translations } = await loadPostAndTranslations(data.postId);
    return buildPreviews(post, translations);
  });

/* ---------- disparo das publicações ---------- */
const DistributeInput = z.object({
  postId: z.string().uuid(),
  pages: z.array(z.enum(["pt", "br", "en", "es", "latam", "fr", "de", "it"])).min(1),
});

export type FacebookDistributeResult = {
  key: FacebookPageKey;
  pageName: string;
  ok: boolean;
  facebookUrl: string | null;
  error: string | null;
};

export const adminFacebookDistribute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DistributeInput.parse(d))
  .handler(async ({ data, context }): Promise<FacebookDistributeResult[]> => {
    assertAdmin(context.claims);
    const { post, translations } = await loadPostAndTranslations(data.postId);
    const previews = buildPreviews(post, translations);

    const targets = FACEBOOK_PAGES.filter((page) => data.pages.includes(page.key));
    const results: FacebookDistributeResult[] = [];

    for (const page of targets) {
      const preview = previews.find((p) => p.key === page.key)!;
      const fail = (error: string): FacebookDistributeResult => ({
        key: page.key, pageName: page.pageName, ok: false, facebookUrl: null, error,
      });

      if (!preview.hasContent) {
        results.push(fail("Sem resumo ou título neste idioma."));
        continue;
      }
      const token = process.env[page.tokenEnv];
      if (!token) {
        results.push(fail("Access token da página não configurado no servidor."));
        continue;
      }

      try {
        // Com imagem de capa: publica a foto com o texto e o link na legenda.
        // Sem capa: publica o link, e o Facebook monta o cartão com os dados da página.
        const usePhoto = Boolean(preview.coverUrl);
        const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${page.pageId}/${usePhoto ? "photos" : "feed"}`;
        const body = new URLSearchParams({ access_token: token });
        if (usePhoto) {
          body.set("url", preview.coverUrl!);
          body.set("caption", `${preview.message}\n\n${preview.url}`);
        } else {
          body.set("message", preview.message);
          body.set("link", preview.url);
        }
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });
        const responseBody = await response.text();
        if (!response.ok) {
          console.error(`Facebook post failed [${response.status}] page ${page.pageName}: ${responseBody}`);
          results.push(fail(`Facebook recusou a publicação (${response.status}).`));
          continue;
        }
        const parsed = JSON.parse(responseBody) as { id?: string; post_id?: string };
        const rawId = parsed.post_id ?? parsed.id ?? "";
        const postSlug = rawId.includes("_") ? rawId.split("_")[1] : rawId;
        results.push({
          key: page.key,
          pageName: page.pageName,
          ok: true,
          facebookUrl: postSlug ? `https://www.facebook.com/${page.pageId}/posts/${postSlug}` : null,
          error: null,
        });
      } catch (e) {
        console.error(`Facebook post error page ${page.pageName}:`, e);
        results.push(fail("Falha de conexão com o Facebook. Tente novamente."));
      }
    }

    return results;
  });
