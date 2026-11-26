import { createFileRoute } from "@tanstack/react-router";
import { blogUrlEntry, loadBlogPosts, PUBLIC_PAGES, SITEMAP_BASE, xmlResponse } from "@/lib/sitemap-data";
import { findBlogLang } from "@/lib/blog-langs";

const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"';

// /sitemaps/pages.xml (institucionais) e /sitemaps/blog-<idioma>.xml (posts traduzidos).
export const Route = createFileRoute("/sitemaps/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const file = params.file;
        if (file === "pages.xml") {
          const urls = PUBLIC_PAGES.map((p) => `<url><loc>${SITEMAP_BASE}${p}</loc>${p === "/" ? "<priority>1.0</priority>" : ""}</url>`).join("");
          return xmlResponse(`<urlset ${NS}>${urls}</urlset>`);
        }
        const m = /^blog-(.+)\.xml$/.exec(file);
        if (!m || !findBlogLang(m[1])) return new Response("not found", { status: 404 });
        const lang = m[1]!;
        let posts;
        try { posts = await loadBlogPosts(); } catch { return new Response("sitemap error", { status: 500 }); }
        const urls = posts.filter((p) => p.langs.includes(lang)).map((p) => blogUrlEntry(p, lang)).join("");
        return xmlResponse(`<urlset ${NS}>${urls}</urlset>`);
      },
    },
  },
});
