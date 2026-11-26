import { describe, expect, test } from "bun:test";
import { BLOG_LANG_CODES } from "../src/lib/blog-langs";
import { LEGACY_BLOG_LANG_CODES, postTranslationSchema, retainedBlogTranslations } from "../src/lib/blog-translation-schema";

describe("saving previously stored blog translations", () => {
  for (const lang of [...BLOG_LANG_CODES, ...LEGACY_BLOG_LANG_CODES]) {
    test(`accepts stored translation ${lang} without changing its locale or content`, () => {
      const translation = { lang, title: "Existing title", body_html: "<p>Existing body</p>" };
      expect(postTranslationSchema.parse(translation)).toEqual(translation);
    });
  }

  test("rejects unknown and malformed locales", () => {
    for (const lang of ["xx-XX", "es-MX<script>", "", "english"]) {
      expect(postTranslationSchema.safeParse({ lang, title: "Title" }).success).toBe(false);
    }
  });

  test("source regeneration retains legacy content without duplicating active translations", () => {
    const translations = [
      { lang: "en", body_html: "Source" },
      { lang: "es", body_html: "Current target" },
      { lang: "es-MX", body_html: "Mexican text" },
      { lang: "es-HN", body_html: "Honduran text" },
      { lang: "en-AU", body_html: "Australian text" },
    ];
    expect(retainedBlogTranslations(translations, "en")).toEqual(translations.slice(2));
    expect(retainedBlogTranslations(translations, "en-AU")).toEqual(translations.slice(2, 4));
    expect(BLOG_LANG_CODES.includes("es-MX")).toBe(false);
  });
});