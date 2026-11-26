import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "@/lib/app-manager";
import { FACEBOOK_PAGES } from "@/lib/blog-facebook";
import {
  INSTAGRAM_ACCOUNTS,
  buildInstagramCaption,
  type InstagramAccountKey,
} from "@/lib/blog-instagram";

const GRAPH_API_VERSION = "v21.0";

function assertAdmin(claims: unknown) {
  if (!isAppManagerIdentity(claims)) throw new Error("Área restrita ao AppManager.");
}

type TranslationRow = { lang: string; title: string; excerpt: string | null };

export type InstagramPreview = {
  key: InstagramAccountKey;
  accountName: string;
  lang: string | null;
  title: string;
  excerpt: string | null;
  caption: string;
  coverUrl: string | null;
  configured: boolean;
  hasContent: boolean;
  hasImage: boolean;
};

/** Escolhe a tradução que melhor atende a conta do Instagram */
function pickTranslation(translations: TranslationRow[], preferredLangs: string[]): TranslationRow | null {
  const withText = translations.filter((t) => (t.excerpt ?? "").trim() || t.title.trim());
  if (!withText.length) return null;
  for (const lang of preferredLangs) {
    const exact = withText.find((t) => t.lang === lang);
    if (exact) return exact;
  }
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
): InstagramPreview[] {
  return INSTAGRAM_ACCOUNTS.map((acc) => {
    const chosen = pickTranslation(translations, acc.langs);
    const lang = chosen?.lang ?? acc.langs[0]!;
    const title = chosen?.title ?? "";
    const caption = chosen ? buildInstagramCaption(chosen.excerpt, chosen.title, lang, post.slug) : "";
    const hasToken = Boolean(process.env[acc.tokenEnv]);
    const hasAccountId = Boolean(process.env[acc.accountIdEnv]);

    return {
      key: acc.key,
      accountName: acc.accountName,
      lang: chosen?.lang ?? null,
      title,
      excerpt: chosen?.excerpt ?? null,
      caption,
      coverUrl: post.cover_image_url,
      configured: hasToken || hasAccountId,
      hasContent: Boolean(chosen),
      hasImage: Boolean(post.cover_image_url),
    };
  });
}

/* ---------- prévias do Instagram ---------- */
export const adminInstagramPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { post, translations } = await loadPostAndTranslations(data.postId);
    return buildPreviews(post, translations);
  });

/* ---------- disparo das publicações no Instagram ---------- */
const DistributeInstagramInput = z.object({
  postId: z.string().uuid(),
  accounts: z.array(z.enum(["br", "pt", "en", "es", "latam", "fr", "de", "it"])).min(1),
  /** URLs de imagens customizadas (ex: geradas com texto sobreposto) por chave de conta */
  customImageUrls: z.record(z.string().url()).optional(),
});

export type InstagramDistributeResult = {
  key: InstagramAccountKey;
  accountName: string;
  ok: boolean;
  instagramUrl: string | null;
  error: string | null;
};

/**
 * Descobre o ID da conta Instagram Business vinculada à página do Facebook
 * caso a variável IG_ACCOUNT_ID_<KEY> não esteja preenchida diretamente.
 */
async function resolveInstagramAccountId(pageId: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}?fields=instagram_business_account&access_token=${token}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { instagram_business_account?: { id: string } };
    return json.instagram_business_account?.id ?? null;
  } catch {
    return null;
  }
}

export const adminInstagramDistribute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DistributeInstagramInput.parse(d))
  .handler(async ({ data, context }): Promise<InstagramDistributeResult[]> => {
    assertAdmin(context.claims);
    const { post, translations } = await loadPostAndTranslations(data.postId);
    const previews = buildPreviews(post, translations);

    const targets = INSTAGRAM_ACCOUNTS.filter((acc) => data.accounts.includes(acc.key));
    const results: InstagramDistributeResult[] = [];

    for (const acc of targets) {
      const preview = previews.find((p) => p.key === acc.key)!;
      const fail = (error: string): InstagramDistributeResult => ({
        key: acc.key,
        accountName: acc.accountName,
        ok: false,
        instagramUrl: null,
        error,
      });

      if (!preview.hasContent) {
        results.push(fail("Sem resumo ou título neste idioma."));
        continue;
      }

      // Instagram exige imagem pública (capa do post ou card gerado com título)
      const imageUrl = data.customImageUrls?.[acc.key] ?? preview.coverUrl;
      if (!imageUrl) {
        results.push(fail("Instagram exige uma imagem pública. Configure a capa do post ou gere um card."));
        continue;
      }

      const token = process.env[acc.tokenEnv];
      if (!token) {
        results.push(fail(`Token não encontrado (defina ${acc.tokenEnv} nas variáveis de ambiente).`));
        continue;
      }

      // Determina o ID numérico da conta do Instagram
      let igUserId = process.env[acc.accountIdEnv];
      if (!igUserId) {
        const matchingFbPage = FACEBOOK_PAGES.find((p) => p.key === acc.facebookPageKey);
        if (matchingFbPage) {
          igUserId = (await resolveInstagramAccountId(matchingFbPage.pageId, token)) ?? undefined;
        }
      }

      if (!igUserId) {
        results.push(
          fail(`Conta do Instagram não encontrada. Vincule a conta à página ou defina ${acc.accountIdEnv}.`),
        );
        continue;
      }

      try {
        // Passo 1: Criar o Container de Mídia (POST /{ig_user_id}/media)
        const containerBody = new URLSearchParams({
          image_url: imageUrl,
          caption: preview.caption,
          access_token: token,
        });

        const containerRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: containerBody,
          },
        );

        const containerData = await containerRes.text();
        if (!containerRes.ok) {
          console.error(`Instagram container failed [${containerRes.status}] ${acc.accountName}: ${containerData}`);
          results.push(fail(`Erro ao preparar imagem no Instagram (${containerRes.status}).`));
          continue;
        }

        const containerJson = JSON.parse(containerData) as { id?: string };
        const creationId = containerJson.id;
        if (!creationId) {
          results.push(fail("ID de container não retornado pelo Instagram."));
          continue;
        }

        // Aguarda 1.5s para o processamento do container pela Meta
        await new Promise((r) => setTimeout(r, 1500));

        // Passo 2: Publicar o Container (POST /{ig_user_id}/media_publish)
        const publishBody = new URLSearchParams({
          creation_id: creationId,
          access_token: token,
        });

        const publishRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${igUserId}/media_publish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: publishBody,
          },
        );

        const publishData = await publishRes.text();
        if (!publishRes.ok) {
          console.error(`Instagram publish failed [${publishRes.status}] ${acc.accountName}: ${publishData}`);
          results.push(fail(`Erro ao publicar no feed do Instagram (${publishRes.status}).`));
          continue;
        }

        const publishJson = JSON.parse(publishData) as { id?: string };
        const mediaId = publishJson.id;

        // Passo 3: Buscar o permalink do post publicado
        let postUrl: string | null = null;
        if (mediaId) {
          try {
            const permalinkRes = await fetch(
              `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}?fields=permalink&access_token=${token}`,
            );
            if (permalinkRes.ok) {
              const permalinkJson = (await permalinkRes.json()) as { permalink?: string };
              postUrl = permalinkJson.permalink ?? null;
            }
          } catch {
            // Silently fallback se a busca de permalink falhar
          }
        }

        results.push({
          key: acc.key,
          accountName: acc.accountName,
          ok: true,
          instagramUrl: postUrl ?? `https://www.instagram.com/${acc.accountName}`,
          error: null,
        });
      } catch (e) {
        console.error(`Instagram error ${acc.accountName}:`, e);
        results.push(fail("Falha de conexão com a API do Instagram. Tente novamente."));
      }
    }

    return results;
  });

/* ---------- upload de card social gerado (base64) para URL pública permanente ---------- */
export const adminUploadSocialCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      base64Image: z.string().min(100),
      accountKey: z.string(),
      postId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { storeCoverBytes } = await import("@/lib/blog-ai.server");
    const clean = data.base64Image.replace(/^data:[^;]+;base64,/, "");
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const publicUrl = await storeCoverBytes(bytes, "image/jpeg");
    return { publicUrl };
  });
