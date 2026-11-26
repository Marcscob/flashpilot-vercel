import { createFileRoute } from "@tanstack/react-router";
import { loadBlogPosts, SITEMAP_BASE, xmlResponse } from "@/lib/sitemap-data";

// Índice: aponta para o sitemap das páginas e um sitemap de blog por idioma com traduções salvas.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let posts;
        try { posts = await loadBlogPosts(); } catch { return new Response("sitemap error", { status: 500 }); }
        const langs = Array.from(new Set(posts.flatMap((p) => p.langs))).sort();
        const items = [`${SITEMAP_BASE}/sitemaps/pages.xml`, ...langs.map((l) => `${SITEMAP_BASE}/sitemaps/blog-${l}.xml`)]
          .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join("");
        return xmlResponse(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`);
      },
    },
  },
});
