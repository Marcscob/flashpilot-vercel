import { expect, test } from "bun:test";
import { blogCtaText, blogCtaLang } from "../src/components/blog/BlogCta";
import { BLOG_LANGS } from "../src/lib/blog-langs";

test("blogCtaText has a localized CTA button text for every cataloged language", () => {
  for (const lang of BLOG_LANGS) {
    const text = blogCtaText(lang.code);
    expect(text).toBeDefined();
    expect(text.trim().length).toBeGreaterThan(5);
  }

  // Especificamente o caso de afrikaans reportado pelo usuário
  expect(blogCtaText("af")).toBe("Skep jou gratis flitskaarte hier");
  expect(blogCtaText("es-AR")).toBe("Creá tus flashcards gratis acá");
  expect(blogCtaText("ru")).toBe("Создайте свои бесплатные карточки здесь");
  expect(blogCtaText("pt-PT")).toBe("Crie os seus flashcards grátis aqui");
  expect(blogCtaText("zh-CN")).toBe("在此免费创建您的抽认卡");
});

test("blogCtaLang routes to the proper landing page locale", () => {
  expect(blogCtaLang("af")).toBe("af");
  expect(blogCtaLang("ru")).toBe("ru");
  expect(blogCtaLang("es-AR")).toBe("es");
  expect(blogCtaLang("pt")).toBe("pt");
  expect(blogCtaLang("pt-PT")).toBe("pt-PT");
  expect(blogCtaLang("unknown")).toBe("en");
});
