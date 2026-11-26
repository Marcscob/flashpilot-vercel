import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { generateBlogPostText, translatePostText, generateCoverImage } from "@/lib/blog-ai.server";
import { normalizeBlogBodyHtml } from "@/lib/blog-content";
import { BLOG_LANG_CODES } from "@/lib/blog-langs";
import { isAppManagerIdentity } from "@/lib/app-manager";
import { blogSlugSchema } from "@/lib/blog-slug";
import { postTranslationSchema, retainedBlogTranslations } from "@/lib/blog-translation-schema";

const BLOG_AI_TOPIC_MAX_CHARS = 500;
const BLOG_AI_TITLE_MAX_CHARS = 300;
const BLOG_AI_EXCERPT_MAX_CHARS = 2_000;
const BLOG_AI_BODY_MAX_CHARS = 50_000;
const blogAiLangSchema = z.enum(BLOG_LANG_CODES);

function getReadingTime(bodyHtml: string): number {
  const text = bodyHtml.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ");
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

async function prepareTranslations(
  translations: z.infer<typeof postTranslationSchema>[],
  sourceLang: string,
  overwriteExisting = false,
  keepLangs: Set<string> = new Set(),
): Promise<{ translations: z.infer<typeof postTranslationSchema>[]; failed: string[] }> {
  const source = translations.find((t) => t.lang === sourceLang && (t.title.trim() || t.body_html.trim()))
    ?? translations.find((t) => t.title.trim() || t.body_html.trim());
  if (!source) return { translations: [], failed: [] };

  const normalizedSource = {
    ...source,
    title: source.title.trim(),
    excerpt: source.excerpt?.trim() || null,
    body_html: normalizeBlogBodyHtml(source.body_html),
  };
  const provided = new Map(translations.map((translation) => [translation.lang, translation]));
  const targets = BLOG_LANG_CODES.filter((lang) => lang !== source.lang);
  const failed: string[] = [];
  const translated = await Promise.all(targets.map(async (lang) => {
    const existing = provided.get(lang);
    if ((!overwriteExisting || keepLangs.has(lang)) && existing?.title.trim() && existing.body_html.trim()) {
      return {
        ...existing,
        title: existing.title.trim(),
        excerpt: existing.excerpt?.trim() || null,
        body_html: normalizeBlogBodyHtml(existing.body_html),
      };
    }

    if (!normalizedSource.body_html) {
      return existing?.title.trim() || existing?.body_html.trim()
        ? {
            ...existing,
            title: existing.title.trim(),
            excerpt: existing.excerpt?.trim() || null,
            body_html: normalizeBlogBodyHtml(existing.body_html),
          }
        : null;
    }

    try {
      return {
        lang,
        ...(await translatePostText(
          normalizedSource.title,
          normalizedSource.excerpt ?? "",
          normalizedSource.body_html,
          lang,
          source.lang,
        )),
      };
    } catch {
      failed.push(lang);
      return existing?.title.trim() || existing?.body_html.trim()
        ? {
            ...existing,
            title: existing.title.trim(),
            excerpt: existing.excerpt?.trim() || null,
            body_html: normalizeBlogBodyHtml(existing.body_html),
          }
        : null;
    }
  }));
  return {
    translations: [normalizedSource, ...translated.filter((translation) => translation !== null), ...retainedBlogTranslations(translations, source.lang)],
    failed,
  };
}

function assertPublishable(status: string, translations: { title: string; body_html: string }[]) {
  if (!translations.some((t) => t.title.trim())) {
    throw new Error("Informe o título do post.");
  }
  if (status !== "published" && status !== "scheduled") return;
  if (!translations.some((t) => t.title.trim() && t.body_html.trim())) {
    throw new Error("Para publicar ou agendar, informe o título e o conteúdo do post.");
  }
}

function assertSchedule(status: string, publishedAt?: string | null) {
  if (status !== "scheduled") return;
  const scheduledTime = publishedAt ? Date.parse(publishedAt) : Number.NaN;
  if (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now()) {
    throw new Error("Escolha uma data e hora futura para agendar a publicação.");
  }
}

function assertAdmin(claims: unknown) {
  if (!isAppManagerIdentity(claims)) throw new Error("Área restrita ao AppManager.");
  return String((claims as any)?.email ?? "").toLowerCase();
}

function isMissingSaveBlogPostRpc(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202"
    || error.message?.includes("Could not find the function public.save_blog_post") === true;
}

function isMissingCoverWidthColumn(error: { code?: string; message?: string }): boolean {
  return (error.code === "42703" || error.code === "PGRST204")
    && error.message?.includes("cover_image_width") === true;
}

type SaveBlogPostArgs = {
  postId: string | null;
  post: Record<string, Json>;
  authorId: string;
  translations: z.infer<typeof postTranslationSchema>[];
};

async function saveBlogPostDirectly(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  { postId, post, authorId, translations }: SaveBlogPostArgs,
): Promise<string> {
  let savedPostId = postId;

  if (postId) {
    const updatePost = async (values: Record<string, Json>) => {
      if (!Object.keys(values).length) {
        return supabaseAdmin.from("blog_posts").select("id").eq("id", postId).single();
      }
      return supabaseAdmin.from("blog_posts")
        .update(values as Database["public"]["Tables"]["blog_posts"]["Update"])
        .eq("id", postId)
        .select("id")
        .single();
    };
    let result = await updatePost(post);
    if (result.error && isMissingCoverWidthColumn(result.error) && "cover_image_width" in post) {
      const { cover_image_width: _coverImageWidth, ...legacyPost } = post;
      result = await updatePost(legacyPost);
    }
    if (result.error) throw result.error;
    savedPostId = result.data.id;
  } else {
    const insertPost = async (values: Record<string, Json>) =>
      supabaseAdmin.from("blog_posts")
        .insert({ ...values, author_id: authorId } as Database["public"]["Tables"]["blog_posts"]["Insert"])
        .select("id")
        .single();
    let result = await insertPost(post);
    if (result.error && isMissingCoverWidthColumn(result.error) && "cover_image_width" in post) {
      const { cover_image_width: _coverImageWidth, ...legacyPost } = post;
      result = await insertPost(legacyPost);
    }
    if (result.error) throw result.error;
    savedPostId = result.data.id;
  }

  if (!savedPostId) throw new Error("O post não foi salvo.");
  if (translations.length) {
    const rows = translations.map((translation) => ({
      post_id: savedPostId,
      lang: translation.lang,
      title: translation.title,
      excerpt: translation.excerpt ?? null,
      body_html: translation.body_html,
      seo_title: translation.seo_title ?? null,
      seo_description: translation.seo_description ?? null,
    }));
    const { error } = await supabaseAdmin
      .from("blog_post_translations")
      .upsert(rows, { onConflict: "post_id,lang" });
    if (error) {
      if (!postId) {
        const { error: rollbackError } = await supabaseAdmin
          .from("blog_posts")
          .delete()
          .eq("id", savedPostId);
        if (rollbackError) {
          throw new Error(`Falha ao salvar traduções: ${error.message}. Também não foi possível remover o rascunho parcial: ${rollbackError.message}`);
        }
      }
      throw error;
    }
  }

  return savedPostId;
}

async function saveBlogPost(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
  args: SaveBlogPostArgs,
): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("save_blog_post", {
    p_post_id: args.postId as string,
    p_post: args.post,
    p_author_id: args.authorId,
    p_translations: args.translations,
  });
  if (!error) return data;
  if (!isMissingSaveBlogPostRpc(error)) throw error;

  console.warn("[Blog] save_blog_post RPC is unavailable; saving post directly.");
  return saveBlogPostDirectly(supabaseAdmin, args);
}

/* ---------- list all posts (admin) ---------- */
export const adminListPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: posts, error } = await supabaseAdmin
      .from("blog_posts")
      .select("id, slug, cover_image_url, category_id, status, featured, published_at, reading_time_min, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const ids = (posts ?? []).map((p) => p.id);
    if (!ids.length) return [];

    const { data: trans, error: transError } = await supabaseAdmin
      .from("blog_post_translations")
      .select("post_id, lang, title")
      .in("post_id", ids);
    if (transError) throw transError;

    const titleMap = new Map<string, string>();
    for (const t of trans ?? []) {
      if (t.lang === "pt" || !titleMap.has(t.post_id)) titleMap.set(t.post_id, t.title);
    }

    return (posts ?? []).map((p) => ({
      ...p,
      title: titleMap.get(p.id) ?? p.slug,
    }));
  });

/* ---------- get single post with all translations (admin) ---------- */
export const adminGetPost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: post, error } = await supabaseAdmin
      .from("blog_posts")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw error;

    const { data: translations, error: translationsError } = await supabaseAdmin
      .from("blog_post_translations")
      .select("*")
      .eq("post_id", data.id);
    if (translationsError) throw translationsError;

    const { data: categories, error: categoriesError } = await supabaseAdmin
      .from("blog_category_translations")
      .select("category_id, lang, name");
    if (categoriesError) throw categoriesError;

    return { post, translations: translations ?? [], categories: categories ?? [] };
  });

/* ---------- create post (admin) ---------- */
const CreateInput = z.object({
  slug: blogSlugSchema,
  cover_image_url: z.string().nullable().optional(),
  cover_image_width: z.number().int().min(25).max(100).default(100),
  category_id: z.string().uuid().nullable().optional(),
  featured: z.boolean().default(false),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  published_at: z.string().nullable().optional(),
  source_lang: z.enum(BLOG_LANG_CODES as [string, ...string[]]).default("en"),
  translations: z.array(postTranslationSchema).min(1),
});

export const adminCreatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    assertSchedule(data.status, data.published_at);
    const prepared = await prepareTranslations(data.translations, data.source_lang);
    const translations = prepared.translations;
    assertPublishable(data.status, translations);
    const source = translations.find((t) => t.lang === data.source_lang) ?? translations[0];
    if (!source) throw new Error("Informe o conteúdo do post.");
    const readingTime = getReadingTime(source.body_html);

    const postId = await saveBlogPost(supabaseAdmin, {
      postId: null,
      post: {
        slug: data.slug,
        cover_image_url: data.cover_image_url ?? null,
        cover_image_width: data.cover_image_width,
        category_id: data.category_id ?? null,
        featured: data.featured,
        status: data.status,
        published_at: data.status === "published" ? new Date().toISOString() : data.published_at ?? null,
        reading_time_min: readingTime,
      },
      authorId: context.userId,
      translations,
    });
    return { id: postId, failedTranslations: prepared.failed };
  });

/* ---------- update post (admin) ---------- */
const UpdateInput = z.object({
  id: z.string().uuid(),
  source_lang: z.enum(BLOG_LANG_CODES as [string, ...string[]]).optional(),
  slug: blogSlugSchema.optional(),
  cover_image_url: z.string().nullable().optional(),
  cover_image_width: z.number().int().min(25).max(100).optional(),
  category_id: z.string().uuid().nullable().optional(),
  featured: z.boolean().optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  published_at: z.string().nullable().optional(),
  translations: z.array(postTranslationSchema).min(1).optional(),
});

export const adminUpdatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.status) assertSchedule(data.status, data.published_at);
    const update: Record<string, Json> = {};
    if (data.slug !== undefined) update.slug = data.slug;
    if (data.cover_image_url !== undefined) update.cover_image_url = data.cover_image_url;
    if (data.cover_image_width !== undefined) update.cover_image_width = data.cover_image_width;
    if (data.category_id !== undefined) update.category_id = data.category_id;
    if (data.featured !== undefined) update.featured = data.featured;
    if (data.status !== undefined) update.status = data.status;
    if (data.status === "published") update.published_at = new Date().toISOString();
    if (data.status === "scheduled" && data.published_at !== undefined) {
      update.published_at = data.published_at;
    }

    let translations = data.translations;
    let failedTranslations: string[] = [];
    if (data.translations) {
      const sourceLang = data.source_lang ?? data.translations[0]?.lang ?? "en";
      const sourceDraft = data.translations.find((t) => t.lang === sourceLang)
        ?? data.translations.find((t) => t.title.trim() || t.body_html.trim());
      let sourceChanged = true;
      let onlyMissing = false;
      const editedLangs = new Set<string>();
      if (sourceDraft) {
        const { data: savedTranslations, error } = await supabaseAdmin
          .from("blog_post_translations")
          .select("lang, title, excerpt, body_html")
          .eq("post_id", data.id);
        if (error) throw error;
        const savedSource = (savedTranslations ?? []).find((t) => t.lang === sourceDraft.lang);
        const hasAllLanguages = BLOG_LANG_CODES.every((lang) => {
          const translation = (savedTranslations ?? []).find((t) => t.lang === lang);
          return translation?.title.trim() && translation.body_html.trim();
        });
        sourceChanged = !savedSource
          || savedSource.title !== sourceDraft.title.trim()
          || (savedSource.excerpt ?? "") !== (sourceDraft.excerpt?.trim() ?? "")
          || savedSource.body_html !== normalizeBlogBodyHtml(sourceDraft.body_html);
        for (const t of data.translations) {
          const saved = (savedTranslations ?? []).find((s) => s.lang === t.lang);
          if (t.lang !== sourceDraft.lang && saved && (saved.title !== t.title.trim()
            || (saved.excerpt ?? "") !== (t.excerpt?.trim() ?? "")
            || saved.body_html !== normalizeBlogBodyHtml(t.body_html))) editedLangs.add(t.lang);
        }
        if (!sourceChanged && Boolean(sourceDraft.body_html.trim()) && !hasAllLanguages) {
          sourceChanged = true;
          onlyMissing = true;
        }
      }
      if (sourceChanged) {
        const prepared = await prepareTranslations(data.translations, sourceLang, !onlyMissing, editedLangs);
        translations = prepared.translations;
        failedTranslations = prepared.failed;
      } else {
        translations = data.translations.map((t) => ({
            ...t,
            title: t.title.trim(),
            excerpt: t.excerpt?.trim() || null,
            body_html: normalizeBlogBodyHtml(t.body_html),
          }));
      }
      assertPublishable(data.status ?? "draft", translations);
      const source = translations.find((t) => t.lang === sourceLang)
        ?? translations[0];
      if (source) update.reading_time_min = getReadingTime(source.body_html);
    } else if (data.status === "published" || data.status === "scheduled") {
      const { data: currentTranslations, error } = await supabaseAdmin
        .from("blog_post_translations")
        .select("title, body_html")
        .eq("post_id", data.id);
      if (error) throw error;
      assertPublishable(data.status, currentTranslations ?? []);
    }

    await saveBlogPost(supabaseAdmin, {
      postId: data.id,
      post: update,
      authorId: context.userId,
      translations: (translations ?? []).map((t) => ({
        lang: t.lang,
        title: t.title,
        excerpt: t.excerpt ?? null,
        body_html: t.body_html,
        seo_title: t.seo_title ?? null,
        seo_description: t.seo_description ?? null,
      })),
    });

    return { ok: true, failedTranslations };
  });

/* ---------- delete post (admin) ---------- */
export const adminDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_posts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- list subscribers (admin) ---------- */
export const adminListSubscribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blog_subscribers")
      .select("id, email, name, lang, confirmed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

/* ---------- list comments (admin) ---------- */
export const adminListComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("blog_comments")
      .select("id, post_id, user_id, body, hidden, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

/* ---------- toggle comment hidden (admin) ---------- */
export const adminToggleComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), hidden: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("blog_comments")
      .update({ hidden: data.hidden })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- delete comment (admin) ---------- */
export const adminDeleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("blog_comments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- generate post with IA (admin) ---------- */
export const adminGeneratePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    topic: z.string().trim().min(1).max(BLOG_AI_TOPIC_MAX_CHARS),
    source_lang: blogAiLangSchema.default("pt"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const generated = await generateBlogPostText(data.topic, data.source_lang);
    return generated;
  });

/* ---------- translate post to ALL languages at once (admin) ---------- */
export const adminTranslateAllPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().max(BLOG_AI_TITLE_MAX_CHARS),
    excerpt: z.string().max(BLOG_AI_EXCERPT_MAX_CHARS),
    body_html: z.string().min(1).max(BLOG_AI_BODY_MAX_CHARS),
    source_lang: blogAiLangSchema.default("en"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { translateAllLanguages } = await import("@/lib/blog-ai.server");
    return await translateAllLanguages(data.title, data.excerpt, data.body_html, data.source_lang);
  });

/* ---------- translate post with IA (admin) ---------- */
export const adminTranslatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    title: z.string().max(BLOG_AI_TITLE_MAX_CHARS),
    excerpt: z.string().max(BLOG_AI_EXCERPT_MAX_CHARS),
    body_html: z.string().min(1).max(BLOG_AI_BODY_MAX_CHARS),
    target_lang: blogAiLangSchema,
    source_lang: blogAiLangSchema.default("pt"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const translated = await translatePostText(data.title, data.excerpt, data.body_html, data.target_lang, data.source_lang);
    return translated;
  });

/* ---------- generate cover image with IA (admin) ---------- */
export const adminGenerateCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ topic: z.string().trim().min(1).max(BLOG_AI_TOPIC_MAX_CHARS) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const url = await generateCoverImage(data.topic);
    return { url };
  });

/* ---------- upload cover image (admin) ---------- */
const BLOG_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const MAX_BLOG_IMAGE_BYTES = 10 * 1024 * 1024;

function decodeBlogImage(base64: string, contentType: string): Uint8Array {
  const dataUrl = base64.match(/^data:([^;,]+);base64,/i);
  if (dataUrl && dataUrl[1]?.toLowerCase() !== contentType) {
    throw new Error("O tipo da imagem não corresponde ao arquivo enviado.");
  }
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  let binary: string;
  try {
    binary = atob(clean);
  } catch {
    throw new Error("O arquivo de imagem é inválido.");
  }
  if (binary.length > MAX_BLOG_IMAGE_BYTES) {
    throw new Error("Cada imagem deve ter no máximo 10 MB.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const adminUploadCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      base64: z.string().min(10).max(Math.ceil(MAX_BLOG_IMAGE_BYTES / 3) * 4 + 128),
      contentType: z.enum(BLOG_IMAGE_TYPES),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { storeCoverBytes } = await import("@/lib/blog-ai.server");
    const bytes = decodeBlogImage(data.base64, data.contentType);
    const url = await storeCoverBytes(bytes, data.contentType);
    return { url };
  });


/* ---------- list categories (admin) ---------- */
export const adminListCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [catRes, transRes] = await Promise.all([
      supabaseAdmin.from("blog_categories").select("id, slug").order("slug"),
      supabaseAdmin.from("blog_category_translations").select("category_id, lang, name"),
    ]);
    const map = new Map<string, Record<string, string>>();
    for (const t of transRes.data ?? []) {
      const cur = map.get(t.category_id) ?? {};
      cur[t.lang] = t.name;
      map.set(t.category_id, cur);
    }
    return (catRes.data ?? []).map((c) => ({ id: c.id, slug: c.slug, translations: map.get(c.id) ?? {} }));
  });

/* ---------- create category (admin) ---------- */
export const adminCreateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    slug: z.string().min(1),
    names: z.record(z.string(), z.string()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cat, error } = await supabaseAdmin
      .from("blog_categories")
      .insert({ slug: data.slug })
      .select("id")
      .single();
    if (error) throw error;

    const rows = Object.entries(data.names).map(([lang, name]) => ({
      category_id: cat.id, lang, name,
    }));
    if (rows.length) {
      const { error: te } = await supabaseAdmin.from("blog_category_translations").insert(rows);
      if (te) throw te;
    }
    return { id: cat.id };
  });
