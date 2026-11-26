import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";

const BASE = "https://flashpilot.net";
import { BrandLogo } from "@/components/BrandLogo";
import { SocialLinks } from "@/components/blog/SocialLinks";
import { SubscribeBox } from "@/components/blog/SubscribeBox";
import { RatingStars } from "@/components/blog/RatingStars";
import { CommentsSection } from "@/components/blog/CommentsSection";
import { BlogLanguagePanel } from "@/components/blog/BlogLanguagePanel";
import { BlogCta, splitArticleHtml } from "@/components/blog/BlogCta";
import { useLang } from "@/lib/i18n";
import { useBlogUi } from "@/lib/blog-ui-i18n";
import { pickClientBlogLang, findBlogLang, BLOG_LANG_EVENT } from "@/lib/blog-langs";
import { getBlogPost, type BlogPostFull } from "@/lib/blog.functions";
import { sanitizeNoteHtml } from "@/lib/sanitize-html";
import { CONTACT_EMAIL } from "@/lib/plan-limit";
import { Clock, ArrowLeft, Star, Share2, User, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAppManagerIdentity } from "@/lib/app-manager";

export const Route = createFileRoute("/$lang/blog/$slug")({
  loader: async ({ params }) => {
    if (!findBlogLang(params.lang)) throw notFound();
    const result = await getBlogPost({ data: { slug: params.slug, lang: params.lang } });
    return { post: result.post, lang: params.lang };
  },
  head: ({ loaderData, params }) => {
    const post = loaderData?.post;
    const slug = encodeURIComponent(params.slug);
    const lang = params.lang;
    const url = `${BASE}/${lang}/blog/${slug}`;
    const title = post?.title ? `${post.title} | FlashPilot Blog` : "FlashPilot Blog";
    const excerpt = post?.excerpt ?? "FlashPilot blog article.";
    const cover = post?.cover_image_url;
    // hreflang somente para traduções realmente salvas.
    const saved = Array.from(
      new Set(
        (post?.translations ?? [])
          .filter((translation) => translation.title?.trim() && findBlogLang(translation.lang))
          .map((translation) => translation.lang),
      ),
    );
    const xDefault = saved.includes("en") ? "en" : saved.includes("pt") ? "pt" : saved[0];
    const alternates = saved.map((language) => ({
      rel: "alternate",
      hrefLang: language === "pt" ? "pt-BR" : language,
      href: `${BASE}/${language}/blog/${slug}`,
    }));
    if (xDefault) {
      alternates.push({
        rel: "alternate",
        hrefLang: "x-default",
        href: `${BASE}/${xDefault}/blog/${slug}`,
      });
    }
    return {
      meta: [
        { title },
        { name: "description", content: excerpt },
        { property: "og:title", content: title },
        { property: "og:description", content: excerpt },
        { property: "og:type", content: "article" },
        ...(cover ? [{ property: "og:image", content: cover }] : []),
        { name: "twitter:card", content: cover ? "summary_large_image" : "summary" },
        ...(cover ? [{ name: "twitter:image", content: cover }] : []),
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }, ...alternates],
      scripts: post
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: post.title,
                description: post.excerpt ?? undefined,
                image: cover ?? undefined,
                inLanguage: lang,
                datePublished: post.published_at ?? undefined,
                author: { "@type": "Organization", name: "FlashPilot" },
                publisher: { "@type": "Organization", name: "FlashPilot", url: BASE },
                mainEntityOfPage: url,
              }),
            },
          ]
        : [],
    };
  },
  component: BlogPostPage,
  errorComponent: BlogRouteMessage,
  notFoundComponent: BlogRouteMessage,
});

function BlogRouteMessage() {
  const { lang } = Route.useParams();
  const { t } = useBlogUi(lang);
  return (
    <div className="flex min-h-screen items-center justify-center text-stone-500">
      {t("Nenhum post encontrado")}
    </div>
  );
}

function BlogHeader({ lang }: { lang: string }) {
  const { t } = useBlogUi(lang);
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-stone-50/90 backdrop-blur-md dark:border-stone-700/50 dark:bg-stone-900/90">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <BrandLogo className="h-[111px] w-auto sm:h-[127px]" priority />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/blog"
            className="hidden text-sm font-medium text-stone-600 hover:text-amber-600 dark:text-stone-300 sm:inline"
          >
            {t("Voltar ao blog")}
          </Link>
          <SocialLinks className="hidden sm:flex" lang={lang} />
          <BlogLanguagePanel initialLang={lang} />
        </div>
      </div>
    </header>
  );
}

function BlogFooter({ lang }: { lang: string }) {
  const { t, dictionary } = useBlogUi(lang);

  return (
    <footer className="mt-8 border-t border-stone-200/60 bg-stone-50 dark:border-stone-700/50 dark:bg-stone-900 lg:mt-16">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-col items-center gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr]">
          <div className="order-2 flex flex-col items-center gap-1 lg:order-1 lg:items-start">
            <span className="text-sm font-medium text-stone-600 dark:text-stone-300">
              {dictionary.shell.contact}
            </span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm text-stone-500 hover:text-amber-600 dark:text-stone-400"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <div className="order-1 flex flex-col items-center gap-3 lg:order-2">
            <Link to="/" className="flex items-center">
              <BrandLogo className="h-[126px] w-auto sm:h-[127px]" />
            </Link>
            <Link
              to="/"
              className="hidden text-sm font-medium text-stone-600 hover:text-amber-600 dark:text-stone-300 lg:inline"
            >
              {t("Conhecer o app")}
            </Link>
          </div>
          <div className="order-3 flex flex-col items-center gap-3 lg:items-end">
            <SocialLinks lang={lang} />
            <Link
              to="/"
              className="text-sm font-medium text-stone-600 hover:text-amber-600 dark:text-stone-300 lg:hidden"
            >
              {t("Conhecer o app")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function BlogPostPage() {
  const { post: initialPost, lang: initialLang } = Route.useLoaderData();
  const { lang: uiLang } = useLang();
  const { t } = useBlogUi(initialLang);
  const navigate = useNavigate();
  // O idioma vem do endereço; trocar no painel leva ao endereço do novo idioma.
  useEffect(() => {
    const onChanged = () => {
      const next = pickClientBlogLang(uiLang);
      if (next !== initialLang && initialPost?.slug) {
        void navigate({ to: "/$lang/blog/$slug", params: { lang: next, slug: initialPost.slug } });
      }
    };
    window.addEventListener(BLOG_LANG_EVENT, onChanged);
    return () => window.removeEventListener(BLOG_LANG_EVENT, onChanged);
  }, [uiLang, initialLang, initialPost?.slug, navigate]);
  const lang = initialLang;
  const [post, setPost] = useState(initialPost);
  const [translationError, setTranslationError] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (lang === initialLang) {
      setPost(initialPost);
      setTranslationError(false);
      return;
    }

    getBlogPost({ data: { slug: initialPost?.slug ?? "", lang } })
      .then(({ post: translatedPost }) => {
        if (cancelled) return;
        setPost(translatedPost);
        setTranslationError(false);
      })
      .catch(() => {
        if (!cancelled) setTranslationError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [initialLang, initialPost, lang]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(isAppManagerIdentity(data.user));
    });
  }, []);
  useEffect(() => {
    if (isAdmin) return;
    const block = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, [contenteditable='true']")) return;
      e.preventDefault();
    };
    const keys = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, [contenteditable='true']")) return;
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "a", "s", "p", "u"].includes(e.key.toLowerCase()))
        e.preventDefault();
    };
    const evs = ["copy", "cut", "contextmenu", "dragstart", "selectstart"];
    evs.forEach((ev) => document.addEventListener(ev, block));
    document.addEventListener("keydown", keys);
    document.body.classList.add("select-none");
    return () => {
      evs.forEach((ev) => document.removeEventListener(ev, block));
      document.removeEventListener("keydown", keys);
      document.body.classList.remove("select-none");
    };
  }, [isAdmin]);

  if (!post) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">
        {t("Nenhum post encontrado")}
      </div>
    );
  }

  const p = post as BlogPostFull;
  // Normaliza todos os títulos do corpo para h3 em negrito (o título do post já é h1)
  // e remove qualquer fonte/tamanho herdado do texto de origem (Word, Docs, sites).
  const safeHtml = sanitizeNoteHtml(p.body_html)
    .replace(/<h[12456](\s[^>]*)?>/gi, "<h3>")
    .replace(/<\/h[12456]>/gi, "</h3>")
    .replace(/<\/?font[^>]*>/gi, "")
    .replace(/\sface\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/style\s*=\s*"([^"]*)"/gi, (_m, css: string) => {
      const cleaned = css
        .split(";")
        .filter(
          (d) =>
            !/^\s*(font|font-family|font-size|font-weight|line-height|letter-spacing)\s*:/i.test(d),
        )
        .join(";")
        .trim();
      return cleaned ? `style="${cleaned}"` : "";
    })
    .replace(/style\s*=\s*'([^']*)'/gi, (_m, css: string) => {
      const cleaned = css
        .split(";")
        .filter(
          (d) =>
            !/^\s*(font|font-family|font-size|font-weight|line-height|letter-spacing)\s*:/i.test(d),
        )
        .join(";")
        .trim();
      return cleaned ? `style="${cleaned}"` : "";
    });

  function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: p.title, url: window.location.href }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <BlogHeader lang={lang} />

      <article className="mx-auto max-w-3xl px-4 pt-8 pb-12">
        {translationError && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {t("Blog temporariamente indisponível")}
          </p>
        )}
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-amber-600 dark:text-stone-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("Voltar ao blog")}
          </Link>
          {isAdmin && (
            <Link
              to="/blog-admin"
              search={{ edit: p.id }}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-stone-800"
            >
              <Pencil className="h-4 w-4" />
              {t("Editar")}
            </Link>
          )}
        </div>

        {p.category_name && (
          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {p.category_name}
          </span>
        )}

        <h1 className="blog-article font-serif text-3xl font-bold leading-tight tracking-tight text-stone-800 dark:text-stone-100 md:text-4xl">
          {p.title}
        </h1>

        {p.excerpt && (
          <p className="mt-4 text-lg leading-relaxed text-stone-600 dark:text-stone-400">
            {p.excerpt}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-stone-500 dark:text-stone-400">
          {p.author_name && (
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {t("por")} {p.author_name}
            </span>
          )}
          {p.published_at && (
            <span>
              {new Date(p.published_at).toLocaleDateString(lang, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {p.reading_time_min} {t("min de leitura")}
          </span>
          {p.rating_count > 0 && (
            <span className="flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {p.avg_rating.toFixed(1)} · {t("{n} avaliações", { n: p.rating_count })}
            </span>
          )}
        </div>

        {p.cover_image_url && (
          <div className="mt-8 text-center">
            <img
              src={p.cover_image_url}
              alt={p.title}
              className="mx-auto h-auto max-w-full rounded-2xl"
              style={{ width: `${p.cover_image_width}%` }}
            />
          </div>
        )}

        {safeHtml.trim() && <BlogCta lang={lang} />}
        {(() => {
          const [first, second] = splitArticleHtml(safeHtml);
          const cls =
            "blog-article prose prose-stone max-w-none text-stone-700 dark:prose-invert dark:text-stone-300 prose-headings:font-serif prose-headings:font-bold prose-headings:text-stone-800 dark:prose-headings:text-stone-100 prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-2xl prose-h3:font-bold prose-h3:text-stone-800 dark:prose-h3:text-stone-100 prose-p:leading-relaxed prose-a:text-amber-600 dark:prose-a:text-amber-400 prose-img:rounded-lg";
          return (
            <>
              <div className={cls} dangerouslySetInnerHTML={{ __html: first }} />
              {second && <BlogCta lang={lang} />}
              {second && <div className={cls} dangerouslySetInnerHTML={{ __html: second }} />}
            </>
          );
        })()}
        {!safeHtml.trim() && (
          <p className="mt-8 text-stone-500 dark:text-stone-400">
            {t("Conteúdo não disponível neste idioma")}
          </p>
        )}
        {safeHtml.trim() && <BlogCta lang={lang} />}

        {/* Share + Rate */}
        <div className="mt-10 flex flex-col items-center gap-6 border-t border-stone-200 pt-8 dark:border-stone-700">
          <RatingStars
            postId={p.id}
            avgRating={p.avg_rating}
            ratingCount={p.rating_count}
            lang={lang}
          />
          <button
            onClick={handleShare}
            className="flex items-center gap-2 rounded-lg border border-stone-300/60 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-amber-400 hover:text-amber-600 dark:border-stone-600/60 dark:text-stone-300"
          >
            <Share2 className="h-4 w-4" />
            {shareCopied ? "✓" : t("Compartilhar")}
          </button>
        </div>

        {/* Comments */}
        <CommentsSection postId={p.id} lang={lang} />

        {/* Subscribe */}
        <div className="mt-12">
          <SubscribeBox lang={lang} />
        </div>
      </article>

      <BlogFooter lang={lang} />
    </div>
  );
}
