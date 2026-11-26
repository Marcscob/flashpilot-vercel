import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { blogSlugSchema, isValidBlogSlug, safeBlogSlug, slugify } from "../src/lib/blog-slug";
import { blogUrlEntry } from "../src/lib/sitemap-data";

describe("blog slug integrity", () => {
  test("lowercases, removes diacritics and replaces special characters with trimmed hyphens", () => {
    expect(slugify(" -- Ação & Revisão: Café! -- ")).toBe("acao-revisao-cafe");
    expect(slugify("Cafe\u0301   ＡＢＣ")).toBe("cafe-abc");
  });

  test("server validation sanitizes received slugs before validation", () => {
    expect(blogSlugSchema.parse("  Ação com PilotAI!  ")).toBe("acao-com-pilotai");
  });

  test("server validation rejects values that normalize to blank", () => {
    for (const slug of ["", "   ", "---", "!@#$", "\u0301", null, 42]) {
      expect(blogSlugSchema.safeParse(slug).success).toBe(false);
    }
  });

  test("updates permit an omitted slug but reject a supplied blank slug", () => {
    const update = z.object({ slug: blogSlugSchema.optional() });
    expect(update.parse({})).toEqual({});
    expect(update.safeParse({ slug: " " }).success).toBe(false);
    expect(update.parse({ slug: " Meu Post " }).slug).toBe("meu-post");
  });

  test("editor fallback never produces an empty or invalid slug", () => {
    expect(safeBlogSlug(" ", "Revisão de Português")).toBe("revisao-de-portugues");
    expect(safeBlogSlug("!!!", "post-123")).toBe("post-123");
    expect(safeBlogSlug("", "")).toBe("post");
  });

  test("sitemap eligibility excludes blank, encoded whitespace and malformed slugs", () => {
    const slugs = ["", " ", "%20", " %20 ", "my post", "UPPER", "-post", "post-", "post--name", "ação", "post/name", "post-123"];
    expect(slugs.filter(isValidBlogSlug)).toEqual(["post-123"]);
  });

  test("URL generation cannot emit an invalid blog slug", () => {
    for (const slug of ["", " ", "%20", "my post", "post/name"]) {
      expect(blogUrlEntry({ slug, published_at: null, langs: ["en"] }, "en")).toBe("");
    }
    expect(blogUrlEntry({ slug: "valid-post", published_at: null, langs: ["en"] }, "en"))
      .toContain("<loc>https://flashpilot.net/en/blog/valid-post</loc>");
  });
});