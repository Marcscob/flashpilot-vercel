import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { SocialLinks } from "@/components/blog/SocialLinks";
import { SubscribeBox } from "@/components/blog/SubscribeBox";
import { BlogLanguagePanel } from "@/components/blog/BlogLanguagePanel";
import { useLang } from "@/lib/i18n";
import { useBlogUi } from "@/lib/blog-ui-i18n";
import { detectLang } from "@/lib/i18n";
import { getInitialBlogLang } from "@/lib/lang.functions";
import { pickClientBlogLang, BLOG_LANG_EVENT } from "@/lib/blog-langs";
import { listBlogPosts, listBlogCategories, type BlogPostCard } from "@/lib/blog.functions";
import { CONTACT_EMAIL } from "@/lib/plan-limit";
import { Star, Clock, Search, ArrowRight, Sparkles, Plus, Settings } from "lucide-react";
import { isAppManagerIdentity } from "@/lib/app-manager";

function useIsBlogAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setIsAdmin(isAppManagerIdentity(data.user));
      })
      .catch(() => {});
  }, []);
  return isAdmin;
}

function BlogRouteMessage() {
  const { lang: uiLang } = useLang();
  const lang = typeof window === "undefined" ? uiLang : pickClientBlogLang(uiLang);
  const { t } = useBlogUi(lang);
  return (
    <div className="flex min-h-screen items-center justify-center text-stone-500">
      {t("Blog temporariamente indisponível")}
    </div>
  );
}

export const Route = createFileRoute("/blog/")({
  loader: async () => {
    const lang: string =
      typeof window !== "undefined"
        ? pickClientBlogLang(detectLang())
        : await getInitialBlogLang().catch(() => "en");
    const [posts, categories] = await Promise.all([
      listBlogPosts({ data: { lang, perPage: 1000 } }),
      listBlogCategories({ data: { lang } }),
    ]);
    return { posts, categories, lang };
  },
  head: () => ({
    links: [{ rel: "canonical", href: "https://flashpilot.net/blog" }],
    meta: [
      { property: "og:url", content: "https://flashpilot.net/blog" },
      { title: "Blog do FlashPilot | FlashPilot" },
      {
        name: "description",
        content: "Dicas de estudo, flashcards, memorização e produtividade no blog do FlashPilot.",
      },
      { property: "og:title", content: "Blog do FlashPilot | FlashPilot" },
      {
        property: "og:description",
        content: "Dicas de estudo, flashcards, memorização e produtividade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "pt-BR", href: "https://flashpilot.net/blog" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "pt-PT", href: "https://flashpilot.net/blog" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "en", href: "https://flashpilot.net/blog" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "es", href: "https://flashpilot.net/blog" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "fr", href: "https://flashpilot.net/blog" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "it", href: "https://flashpilot.net/blog" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "de", href: "https://flashpilot.net/blog" },
      },
      {
        tag: "link",
        attrs: { rel: "alternate", hreflang: "x-default", href: "https://flashpilot.net/blog" },
      },
    ],
  }),
  component: BlogListPage,
  errorComponent: BlogRouteMessage,
});

function BlogHeader({ lang }: { lang: string }) {
  const isAdmin = useIsBlogAdmin();
  const { t } = useBlogUi(lang);
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/60 bg-stone-50/90 backdrop-blur-md dark:border-stone-700/50 dark:bg-stone-900/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <BrandLogo className="h-[111px] w-auto sm:h-[127px]" priority />
        </Link>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <Link
                to="/blog-admin"
                search={{ tab: "new" }}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{t("Criar post")}</span>
              </Link>
              <Link
                to="/blog-admin"
                className="flex items-center gap-1.5 rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-stone-800"
                title={t("Painel do blog")}
              >
                <Settings className="h-4 w-4" />
                <span className="hidden lg:inline">{t("Painel do blog")}</span>
              </Link>
            </>
          )}
          <Link
            to="/"
            className="hidden text-sm font-medium text-stone-600 hover:text-amber-600 dark:text-stone-300 lg:inline"
          >
            {t("Conhecer o app")}
          </Link>
          <SocialLinks className="hidden lg:flex" lang={lang} />
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
      <div className="mx-auto max-w-6xl px-4 py-10">
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
        <p className="mt-8 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} FlashPilot. {t("Todos os idiomas")}
        </p>
      </div>
    </footer>
  );
}

function PostCard({ post, lang }: { post: BlogPostCard; lang: string }) {
  const { t } = useBlogUi(lang);
  return (
    <Link
      to="/$lang/blog/$slug"
      params={{ lang, slug: post.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/60 bg-white transition-all hover:shadow-lg dark:border-stone-700/50 dark:bg-stone-800/60"
    >
      {post.cover_image_url ? (
        <div className="aspect-[16/9] overflow-hidden">
          <img
            src={post.cover_image_url}
            alt={post.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-amber-100 to-stone-100 dark:from-stone-700 dark:to-stone-800">
          <Sparkles className="h-8 w-8 text-amber-400/60" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        {post.category_name && (
          <span className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {post.category_name}
          </span>
        )}
        <h3 className="mb-2 font-serif text-lg font-semibold leading-snug text-stone-800 dark:text-stone-100">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mb-3 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">
            {post.excerpt}
          </p>
        )}
        <div className="mt-auto flex items-center gap-3 text-xs text-stone-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {post.reading_time_min} {t("min de leitura")}
          </span>
          {post.rating_count > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {post.avg_rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function BlogListPage() {
  const initialData = Route.useLoaderData();
  const { posts: initialPosts, categories: initialCategories, lang: initialLang } = initialData;
  const { lang: uiLang } = useLang();
  const [langTick, setLangTick] = useState(0);
  useEffect(() => {
    const onChanged = () => setLangTick((v) => v + 1);
    window.addEventListener(BLOG_LANG_EVENT, onChanged);
    return () => window.removeEventListener(BLOG_LANG_EVENT, onChanged);
  }, []);
  // A 1ª renderização usa o idioma do loader (igual ao servidor) para não gerar divergência de hidratação.
  const [lang, setLang] = useState(initialLang);
  useEffect(() => {
    setLang(pickClientBlogLang(uiLang));
  }, [uiLang, langTick]);
  const { t } = useBlogUi(lang);
  const [posts, setPosts] = useState(initialPosts);
  const [categories, setCategories] = useState(initialCategories);
  const [translationError, setTranslationError] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const isAdmin = useIsBlogAdmin();

  useEffect(() => {
    let cancelled = false;
    if (lang === initialLang) {
      setPosts(initialPosts);
      setCategories(initialCategories);
      setTranslationError(false);
      return;
    }

    Promise.all([
      listBlogPosts({ data: { lang, perPage: 1000 } }),
      listBlogCategories({ data: { lang } }),
    ])
      .then(([nextPosts, nextCategories]) => {
        if (cancelled) return;
        setPosts(nextPosts);
        setCategories(nextCategories);
        setTranslationError(false);
      })
      .catch(() => {
        if (!cancelled) setTranslationError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [initialCategories, initialLang, initialPosts, lang]);

  const filtered = useMemo(() => {
    let list = posts.posts;
    if (activeCat) list = list.filter((p) => p.category_id === activeCat);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) => p.title.toLowerCase().includes(s) || (p.excerpt ?? "").toLowerCase().includes(s),
      );
    }
    return list;
  }, [posts.posts, activeCat, search]);
  const featured =
    page === 1 && !search && !activeCat ? filtered.filter((p) => p.featured).slice(0, 3) : [];
  const featuredIds = new Set(featured.map((p) => p.id));
  const regular = filtered.filter((p) => !featuredIds.has(p.id));
  const pageSize = 9;
  const totalPages = Math.max(1, Math.ceil(regular.length / pageSize));
  const pagePosts = regular.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <BlogHeader lang={lang} />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-8">
        {translationError && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {t("Blog temporariamente indisponível")}
          </p>
        )}
        <h1 className="font-serif text-4xl font-bold text-stone-800 dark:text-stone-100 md:text-5xl">
          {t("Blog do FlashPilot")}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-stone-600 dark:text-stone-400">
          {t("Receba os novos posts do FlashPilot diretamente no seu e-mail.")}
        </p>
        {isAdmin && (
          <Link
            to="/blog-admin"
            search={{ tab: "new" }}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            {t("Criar post")}
          </Link>
        )}
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-8">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-xl font-semibold text-stone-700 dark:text-stone-200">
            <Sparkles className="h-5 w-5 text-amber-500" />
            {t("Posts em destaque")}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {featured.map((p) => (
              <PostCard key={p.id} post={p} lang={lang} />
            ))}
          </div>
        </section>
      )}

      {/* Search + categories */}
      <section className="mx-auto max-w-6xl px-4 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("Buscar posts...")}
              className="w-full rounded-lg border border-stone-300/60 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-stone-800 placeholder-stone-400 outline-none focus:border-amber-400 dark:border-stone-600/60 dark:bg-stone-800/80 dark:text-stone-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setActiveCat(null);
                setPage(1);
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                !activeCat
                  ? "bg-amber-600 text-white"
                  : "border border-stone-300/60 text-stone-600 dark:border-stone-600/60 dark:text-stone-300"
              }`}
            >
              {t("Todos os idiomas")}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCat(c.id);
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeCat === c.id
                    ? "bg-amber-600 text-white"
                    : "border border-stone-300/60 text-stone-600 dark:border-stone-600/60 dark:text-stone-300"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main grid + sidebar */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg text-stone-400">{t("Nenhum post encontrado")}</p>
              </div>
            ) : (
              <>
                {featured.length > 0 && (
                  <div className="mb-6 grid gap-6 sm:grid-cols-2">
                    {featured.map((p) => (
                      <PostCard key={p.id} post={p} lang={lang} />
                    ))}
                  </div>
                )}
                {pagePosts.length > 0 && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {pagePosts.map((p) => (
                      <PostCard key={p.id} post={p} lang={lang} />
                    ))}
                  </div>
                )}
                {totalPages > 1 && (
                  <nav
                    className="mt-8 flex items-center justify-center gap-4"
                    aria-label={t("Paginação do blog")}
                  >
                    <button
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      disabled={page === 1}
                      className="rounded-lg border border-stone-300/60 px-4 py-2 text-sm disabled:opacity-40 dark:border-stone-600/60"
                    >
                      {t("Página anterior")}
                    </button>
                    <span className="text-sm text-stone-500">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                      disabled={page >= totalPages}
                      className="rounded-lg border border-stone-300/60 px-4 py-2 text-sm disabled:opacity-40 dark:border-stone-600/60"
                    >
                      {t("Próxima página")}
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
          <aside className="space-y-6">
            <SubscribeBox lang={lang} />
            <div className="rounded-2xl border border-stone-200/60 bg-white/60 p-6 dark:border-stone-700/50 dark:bg-stone-800/40">
              <h3 className="mb-3 font-serif text-lg font-semibold text-stone-800 dark:text-stone-100">
                {t("Conhecer o app")}
              </h3>
              <p className="mb-4 text-sm text-stone-600 dark:text-stone-400">FlashPilot</p>
              <Link
                to="/"
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                {t("Conhecer o app")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <BlogFooter lang={lang} />
    </div>
  );
}
