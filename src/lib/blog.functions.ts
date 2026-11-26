import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeBlogBodyHtml } from "@/lib/blog-content";
import { BLOG_LANG_CODES } from "./blog-langs";

/* ---------- public read client ---------- */
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/* ---------- types ---------- */
export type BlogPostCard = {
  id: string;
  slug: string;
  cover_image_url: string | null;
  cover_image_width: number;
  category_id: string | null;
  featured: boolean;
  published_at: string | null;
  reading_time_min: number;
  title: string;
  excerpt: string | null;
  category_name: string | null;
  avg_rating: number;
  rating_count: number;
};

export type BlogPostFull = BlogPostCard & {
  body_html: string;
  translations: { lang: string; title: string; excerpt: string | null }[];
  author_name: string | null;
};

type BlogPostListRow = Pick<
  Database["public"]["Tables"]["blog_posts"]["Row"],
  | "id"
  | "slug"
  | "cover_image_url"
  | "cover_image_width"
  | "category_id"
  | "featured"
  | "published_at"
  | "reading_time_min"
>;

type BlogPostRow = BlogPostListRow &
  Pick<Database["public"]["Tables"]["blog_posts"]["Row"], "author_id">;

function isMissingCoverWidthColumn(error: { code?: string; message?: string }): boolean {
  return (
    (error.code === "42703" || error.code === "PGRST204") &&
    error.message?.includes("cover_image_width") === true
  );
}

/* ---------- public: list posts ---------- */
const ListInput = z.object({
  lang: z.string().default("pt"),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(1000).default(9),
  category: z.string().optional(),
  search: z.string().optional(),
});

export const listBlogPosts = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const lang = data.lang;
    const publicationCutoff = new Date().toISOString();
    const from = (data.page - 1) * data.perPage;
    const to = from + data.perPage - 1;

    let q = sb
      .from("blog_posts")
      .select(
        "id, slug, cover_image_url, cover_image_width, category_id, featured, published_at, reading_time_min",
        { count: "exact" },
      )
      .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${publicationCutoff})`)
      .order("published_at", { ascending: false })
      .range(from, to);

    if (data.category) q = q.eq("category_id", data.category);
    const result = await q;
    let posts: BlogPostListRow[] = result.data ?? [];
    let count = result.count;
    if (result.error && isMissingCoverWidthColumn(result.error)) {
      let fallbackQuery = sb
        .from("blog_posts")
        .select(
          "id, slug, cover_image_url, category_id, featured, published_at, reading_time_min",
          { count: "exact" },
        )
        .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${publicationCutoff})`)
        .order("published_at", { ascending: false })
        .range(from, to);
      if (data.category) fallbackQuery = fallbackQuery.eq("category_id", data.category);
      const fallback = await fallbackQuery;
      if (fallback.error) throw fallback.error;
      posts = (fallback.data ?? []).map((post) => ({ ...post, cover_image_width: 100 }));
      count = fallback.count;
    } else if (result.error) {
      throw result.error;
    }

    // fetch translations + ratings for each post
    const ids = (posts ?? []).map((p) => p.id);
    if (!ids.length) return { posts: [], total: 0, page: data.page, perPage: data.perPage };

    const idBatches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
      ids.slice(i * 100, (i + 1) * 100),
    );
    const [translationBatches, catRes, ratingBatches] = await Promise.all([
      Promise.all(
        idBatches.map((batch) =>
          sb
            .from("blog_post_translations")
            .select("post_id, lang, title, excerpt")
            .in("post_id", batch),
        ),
      ),
      sb.from("blog_category_translations").select("category_id, lang, name"),
      Promise.all(
        idBatches.map((batch) =>
          sb.from("blog_ratings").select("post_id, stars").in("post_id", batch),
        ),
      ),
    ]);
    if (catRes.error) throw catRes.error;
    for (const result of [...translationBatches, ...ratingBatches]) {
      if (result.error) throw result.error;
    }
    const postTranslations = translationBatches.flatMap((result) => result.data ?? []);
    const postRatings = ratingBatches.flatMap((result) => result.data ?? []);

    const { resolveBlogLang, blogBaseLang } = await import("@/lib/blog-live-translate.server");
    const target = resolveBlogLang(lang);
    const baseOf = blogBaseLang(target);
    const transMap = new Map<string, { title: string; excerpt: string | null }>();
    for (const id of ids) {
      const rows = postTranslations.filter((t) => t.post_id === id);
      const own = rows.find((t) => t.lang === target) ?? null;
      const source =
        (baseOf ? rows.find((t) => t.lang === baseOf && t.title?.trim()) : undefined) ??
        rows.find((t) => t.lang === "en" && t.lang !== target && t.title?.trim()) ??
        rows.find((t) => t.lang !== target && t.title?.trim());
      const title = own?.title?.trim() ? own.title : "";
      const excerpt = own?.excerpt?.trim() ? own.excerpt : "";
      transMap.set(id, {
        title: title || source?.title || "",
        excerpt: excerpt || source?.excerpt || null,
      });
    }

    const catMap = new Map<string, string | null>();
    for (const c of catRes.data ?? []) {
      if (c.lang === target) {
        catMap.set(c.category_id, c.name);
      }
    }
    if (baseOf && baseOf !== target) {
      for (const c of catRes.data ?? []) {
        if (!catMap.has(c.category_id) && c.lang === baseOf) {
          catMap.set(c.category_id, c.name);
        }
      }
    }
    for (const c of catRes.data ?? []) {
      if (!catMap.has(c.category_id) && c.lang === "en") {
        catMap.set(c.category_id, c.name);
      }
    }
    for (const c of catRes.data ?? []) {
      if (!catMap.has(c.category_id)) catMap.set(c.category_id, c.name);
    }

    const ratingMap = new Map<string, { sum: number; count: number }>();
    for (const r of postRatings) {
      const cur = ratingMap.get(r.post_id) ?? { sum: 0, count: 0 };
      cur.sum += r.stars;
      cur.count++;
      ratingMap.set(r.post_id, cur);
    }

    const cards: BlogPostCard[] = (posts ?? []).map((p) => {
      const tr = transMap.get(p.id);
      const rt = ratingMap.get(p.id);
      return {
        id: p.id,
        slug: p.slug,
        cover_image_url: p.cover_image_url,
        cover_image_width: p.cover_image_width,
        category_id: p.category_id,
        featured: p.featured,
        published_at: p.published_at,
        reading_time_min: p.reading_time_min,
        title: tr?.title ?? p.slug,
        excerpt: tr?.excerpt ?? null,
        category_name: p.category_id ? (catMap.get(p.category_id) ?? null) : null,
        avg_rating: rt ? rt.sum / rt.count : 0,
        rating_count: rt?.count ?? 0,
      };
    });

    // search filter (client-side simple)
    let filtered = cards;
    if (data.search) {
      const s = data.search.toLowerCase();
      filtered = cards.filter(
        (c) => c.title.toLowerCase().includes(s) || (c.excerpt ?? "").toLowerCase().includes(s),
      );
    }

    return { posts: filtered, total: count ?? 0, page: data.page, perPage: data.perPage };
  });

/* ---------- public: get single post ---------- */
const SlugInput = z.object({ slug: z.string(), lang: z.string().default("pt") });

export const getBlogPost = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => SlugInput.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const publicationCutoff = new Date().toISOString();
    const postQuery = sb
      .from("blog_posts")
      .select(
        "id, slug, cover_image_url, cover_image_width, category_id, featured, published_at, reading_time_min, author_id",
      )
      .eq("slug", data.slug)
      .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${publicationCutoff})`)
      .single();
    const result = await postQuery;
    let post: BlogPostRow | null = result.data;
    if (result.error && isMissingCoverWidthColumn(result.error)) {
      const fallback = await sb
        .from("blog_posts")
        .select(
          "id, slug, cover_image_url, category_id, featured, published_at, reading_time_min, author_id",
        )
        .eq("slug", data.slug)
        .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${publicationCutoff})`)
        .single();
      if (fallback.error) {
        if (fallback.error.code === "PGRST116") return { post: null };
        throw fallback.error;
      }
      post = fallback.data ? { ...fallback.data, cover_image_width: 100 } : null;
    } else if (result.error) {
      if (result.error.code === "PGRST116") return { post: null };
      throw result.error;
    }
    if (!post) return { post: null };

    const [transRes, catTransRes, ratingRes, authorRes] = await Promise.all([
      sb
        .from("blog_post_translations")
        .select("lang, title, excerpt, body_html")
        .eq("post_id", post.id),
      post.category_id
        ? sb
            .from("blog_category_translations")
            .select("lang, name")
            .eq("category_id", post.category_id)
        : Promise.resolve({ data: [], error: null }),
      sb.from("blog_ratings").select("stars").eq("post_id", post.id),
      sb.from("profiles").select("full_name").eq("user_id", post.author_id).single(),
    ]);
    if (transRes.error) throw transRes.error;
    if (catTransRes.error) throw catTransRes.error;
    if (ratingRes.error) throw ratingRes.error;

    // Reader language (unsupported → English). Missing fields are translated live.
    const { resolveBlogLang, blogBaseLang, translateBlogFields, persistBlogTranslation } =
      await import("@/lib/blog-live-translate.server");
    const target = resolveBlogLang(data.lang);
    const baseOf = blogBaseLang(target);
    const translations = transRes.data ?? [];
    const own = translations.find((t) => t.lang === target) ?? null;
    const source =
      (baseOf
        ? translations.find((t) => t.lang === baseOf && t.body_html?.trim() && t.title?.trim())
        : undefined) ??
      translations.find(
        (t) => t.lang !== target && t.body_html?.trim() && t.title?.trim() && t.lang === "en",
      ) ??
      translations.find((t) => t.lang !== target && t.body_html?.trim() && t.title?.trim()) ??
      translations.find((t) => t.lang !== target);
    let title = own?.title?.trim() ? own.title : "";
    let excerpt = own?.excerpt?.trim() ? own.excerpt : "";
    let body = own?.body_html?.trim() ? own.body_html : "";
    if (source && (!title || (!excerpt && source.excerpt?.trim()) || !body)) {
      const missing: { title?: string; excerpt?: string; body_html?: string } = {};
      if (!title) missing.title = source.title;
      if (!excerpt && source.excerpt?.trim()) missing.excerpt = source.excerpt;
      if (!body && source.body_html?.trim())
        missing.body_html = normalizeBlogBodyHtml(source.body_html);
      const tr = await translateBlogFields(missing, target);
      await persistBlogTranslation(post.id, target, own, tr);
      title = title || tr.title || source.title;
      excerpt = excerpt || tr.excerpt || source.excerpt || "";
      body = body || tr.body_html || source.body_html || "";
    }

    const catName =
      (catTransRes.data ?? []).find((c) => c.lang === target)?.name ??
      (catTransRes.data ?? []).find((c) => c.lang === "en")?.name ??
      (catTransRes.data ?? [])[0]?.name ??
      null;

    const ratings = ratingRes.data ?? [];
    const avg = ratings.length ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length : 0;

    const full: BlogPostFull = {
      id: post.id,
      slug: post.slug,
      cover_image_url: post.cover_image_url,
      cover_image_width: post.cover_image_width,
      category_id: post.category_id,
      featured: post.featured,
      published_at: post.published_at,
      reading_time_min: post.reading_time_min,
      title: title || post.slug,
      excerpt: excerpt || null,
      body_html: normalizeBlogBodyHtml(body),
      category_name: catName,
      avg_rating: avg,
      rating_count: ratings.length,
      translations: translations.map((t) => ({ lang: t.lang, title: t.title, excerpt: t.excerpt })),
      author_name: authorRes.data?.full_name ?? null,
    };

    return { post: full };
  });

/* ---------- public: list categories ---------- */
export const listBlogCategories = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ lang: z.string().default("pt") }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { resolveBlogLang, blogBaseLang } = await import("@/lib/blog-live-translate.server");
    const target = resolveBlogLang(data.lang);
    const baseOf = blogBaseLang(target);
    const [catRes, transRes] = await Promise.all([
      sb.from("blog_categories").select("id, slug"),
      sb.from("blog_category_translations").select("category_id, lang, name"),
    ]);
    if (catRes.error) throw catRes.error;
    if (transRes.error) throw transRes.error;
    const map = new Map<string, string>();
    for (const t of transRes.data ?? []) {
      if (t.lang === target) {
        map.set(t.category_id, t.name);
      }
    }
    if (baseOf && baseOf !== target) {
      for (const t of transRes.data ?? []) {
        if (!map.has(t.category_id) && t.lang === baseOf) map.set(t.category_id, t.name);
      }
    }
    for (const t of transRes.data ?? []) {
      if (!map.has(t.category_id) && t.lang === "en") map.set(t.category_id, t.name);
    }
    for (const t of transRes.data ?? []) {
      if (!map.has(t.category_id)) map.set(t.category_id, t.name);
    }
    return (catRes.data ?? []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: map.get(c.id) ?? c.slug,
    }));
  });

/* ---------- public: subscribe ---------- */
const SubscribeInput = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().max(120).optional().default(""),
  lang: z.enum(BLOG_LANG_CODES).default("en"),
});

async function sendBlogSubscriptionConfirmation(
  email: string,
  lang: string,
  subscriberId: string,
  token: string,
): Promise<void> {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const confirmationUrl = new URL("/blog/confirm-subscription", "https://flashpilot.net");
  confirmationUrl.searchParams.set("token", token);
  confirmationUrl.searchParams.set("lang", lang);
  await sendTemplateEmail("blog-subscription-confirmation", email, {
    templateData: { lang, confirmationUrl: confirmationUrl.toString() },
    idempotencyKey: `blog-subscription-confirm-${subscriberId}-${token}`,
  });
}

export const blogSubscribe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SubscribeInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    // Token criptograficamente seguro (não usar Math.random()/Date.now(), que são
    // previsíveis e permitiriam confirmar/adulterar inscrições de outras pessoas).
    const token = crypto.randomUUID();
    const { data: inserted, error } = await supabaseAdmin
      .from("blog_subscribers")
      .insert({
        email,
        name: data.name || null,
        lang: data.lang,
        confirmation_token: token,
        confirmed_at: null,
      })
      .select("id")
      .single();

    if (error) {
      // Keep the public response identical for new and existing addresses.
      if (error.code === "23505") {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("blog_subscribers")
          .select("id, confirmed_at, lang, confirmation_token")
          .eq("email", email)
          .maybeSingle();
        if (existingError) throw existingError;
        if (!existing) throw error;
        if (existing.confirmed_at) return { ok: true, alreadySubscribed: false };
        // Never let an unauthenticated caller rewrite another person's pending record:
        // only resend the original confirmation, in the language stored at signup.
        if (existing.confirmation_token) {
          await sendBlogSubscriptionConfirmation(
            email,
            existing.lang ?? data.lang,
            existing.id,
            existing.confirmation_token,
          );
        }
        return { ok: true, alreadySubscribed: false };
      }
      throw error;
    }
    if (!inserted) throw new Error("A inscrição não foi salva.");
    await sendBlogSubscriptionConfirmation(email, data.lang, inserted.id, token);
    // O token só deve chegar ao dono do e-mail (por e-mail de confirmação), nunca
    // na resposta HTTP: devolvê-lo aqui permitiria a quem observar a chamada
    // confirmar a inscrição sem provar posse do e-mail.
    return { ok: true, alreadySubscribed: false };
  });

/* ---------- public: confirm subscription ---------- */
export const blogConfirmSubscription = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error } = await supabaseAdmin
      .from("blog_subscribers")
      .select("id")
      .eq("confirmation_token", data.token)
      .is("confirmed_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!sub) return { ok: false };

    const { data: confirmed, error: updateError } = await supabaseAdmin
      .from("blog_subscribers")
      .update({ confirmed_at: new Date().toISOString(), confirmation_token: null })
      .eq("id", sub.id)
      .eq("confirmation_token", data.token)
      .is("confirmed_at", null)
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!confirmed) return { ok: false };

    return { ok: true };
  });

/* ---------- public: unsubscribe ---------- */
export const blogUnsubscribe = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("blog_subscribers")
      .delete()
      .eq("unsubscribe_token", data.token);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- authenticated: add comment ---------- */
const CommentInput = z.object({ postId: z.string().uuid(), body: z.string().min(1).max(2000) });

/** Intervalo mínimo entre comentários do mesmo usuário, para evitar flood/spam. */
const COMMENT_COOLDOWN_MS = 15_000;
/** Teto diário por usuário, como segunda camada contra spam automatizado. */
const COMMENT_DAILY_LIMIT = 200;

export const blogAddComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommentInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const publicationCutoff = new Date().toISOString();
    const { data: post, error: postError } = await supabaseAdmin
      .from("blog_posts")
      .select("id")
      .eq("id", data.postId)
      .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${publicationCutoff})`)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) throw new Error("Este artigo não está disponível para comentários.");

    const since = new Date(Date.now() - COMMENT_COOLDOWN_MS).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [recentResult, dailyResult] = await Promise.all([
      supabaseAdmin
        .from("blog_comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("created_at", since),
      supabaseAdmin
        .from("blog_comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("created_at", dayAgo),
    ]);
    if (recentResult.error) throw recentResult.error;
    if (dailyResult.error) throw dailyResult.error;
    const recentCount = recentResult.count ?? 0;
    const dailyCount = dailyResult.count ?? 0;

    if (recentCount > 0) throw new Error("Aguarde alguns segundos antes de comentar de novo.");
    if (dailyCount >= COMMENT_DAILY_LIMIT)
      throw new Error("Limite diário de comentários atingido.");

    const { data: inserted, error } = await supabaseAdmin
      .from("blog_comments")
      .insert({
        post_id: data.postId,
        user_id: context.userId,
        body: data.body,
      })
      .select("id, created_at")
      .single();
    if (error) throw error;

    // Cópia interna: falha no envio nunca deve impedir o comentário.
    try {
      const [postResult, translationsResult, profileResult, userResult] = await Promise.all([
        supabaseAdmin.from("blog_posts").select("slug").eq("id", data.postId).single(),
        supabaseAdmin
          .from("blog_post_translations")
          .select("lang, title")
          .eq("post_id", data.postId),
        supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("user_id", context.userId)
          .maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(context.userId),
      ]);
      const translations = translationsResult.data ?? [];
      const title =
        (
          translations.find((t) => t.lang === "pt") ??
          translations.find((t) => t.lang === "en") ??
          translations[0]
        )?.title ??
        postResult.data?.slug ??
        "";
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("blog-comment-notification", "contact@flashpilot.net", {
        templateData: {
          postTitle: title,
          postUrl: `https://flashpilot.net/pt/blog/${encodeURIComponent(postResult.data?.slug ?? "")}`,
          authorName: profileResult.data?.full_name ?? "—",
          authorEmail: userResult.data.user?.email ?? null,
          comment: data.body,
          createdAt: new Date(inserted.created_at).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          }),
        },
        idempotencyKey: `blog-comment-${inserted.id}`,
      });
    } catch (notifyError) {
      console.error("Blog comment notification failed", {
        errorType: notifyError instanceof Error ? notifyError.name : typeof notifyError,
      });
    }
    return { ok: true };
  });

/* ---------- authenticated: delete own comment ---------- */
export const blogDeleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ commentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("blog_comments")
      .update({ hidden: true, body: "" })
      .eq("id", data.commentId)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- authenticated: rate a post ---------- */
const RatingInput = z.object({ postId: z.string().uuid(), stars: z.number().int().min(1).max(5) });

export const blogRatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RatingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const publicationCutoff = new Date().toISOString();
    const { data: post, error: postError } = await supabaseAdmin
      .from("blog_posts")
      .select("id")
      .eq("id", data.postId)
      .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${publicationCutoff})`)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) throw new Error("Este artigo não está disponível para avaliação.");

    const { error } = await supabaseAdmin.from("blog_ratings").upsert(
      {
        post_id: data.postId,
        user_id: context.userId,
        stars: data.stars,
      },
      { onConflict: "post_id,user_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

/* ---------- authenticated: get my rating ---------- */
export const blogGetMyRating = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rating, error } = await supabaseAdmin
      .from("blog_ratings")
      .select("stars")
      .eq("post_id", data.postId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return { stars: rating?.stars ?? 0 };
  });

/* ---------- public: list comments for a post ---------- */
export const listBlogComments = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ postId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const publicationCutoff = new Date().toISOString();
    const { data: post, error: postError } = await supabaseAdmin
      .from("blog_posts")
      .select("id")
      .eq("id", data.postId)
      .or(`status.eq.published,and(status.eq.scheduled,published_at.lte.${publicationCutoff})`)
      .maybeSingle();
    if (postError) throw postError;
    if (!post) return [];

    const { data: comments, error } = await supabaseAdmin
      .from("blog_comments")
      .select("id, body, created_at, user_id")
      .eq("post_id", data.postId)
      .eq("hidden", false)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;

    // fetch author names
    const userIds = [...new Set((comments ?? []).map((c) => c.user_id))];
    const authorMap = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      if (profilesError) throw profilesError;
      for (const p of profiles ?? []) authorMap.set(p.user_id, p.full_name ?? "—");
    }

    return (comments ?? []).map((c) => ({
      id: c.id,
      body: c.body,
      created_at: c.created_at,
      author_name: authorMap.get(c.user_id) ?? "—",
    }));
  });
