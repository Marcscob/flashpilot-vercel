import { createFileRoute, redirect } from "@tanstack/react-router";
import { detectLang } from "@/lib/i18n";
import { getInitialBlogLang } from "@/lib/lang.functions";
import { pickClientBlogLang } from "@/lib/blog-langs";
import { getBlogPost } from "@/lib/blog.functions";

// Endereço antigo: redireciona (301) para a versão com prefixo de idioma.
export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const wanted: string = typeof window !== "undefined"
      ? pickClientBlogLang(detectLang())
      : await getInitialBlogLang().catch(() => "en");
    let lang = wanted;
    try {
      const { post } = await getBlogPost({ data: { slug: params.slug, lang: wanted } });
      const saved = (post?.translations ?? []).filter((t) => t.title?.trim()).map((t) => t.lang);
      if (saved.length && !saved.includes(wanted)) lang = saved.includes("en") ? "en" : saved.includes("pt") ? "pt" : saved[0]!;
    } catch {
      /* post inexistente: a nova rota mostra "não encontrado" */
    }
    throw redirect({ to: "/$lang/blog/$slug", params: { lang, slug: params.slug }, statusCode: 301 });
  },
  head: () => ({ meta: [{ title: "FlashPilot Blog" }, { name: "robots", content: "noindex" }] }),
});
