import { z } from "zod";
import { BLOG_LANG_CODES } from "./blog-langs";

// Stored translations remain editable even when no longer offered as generation targets.
export const LEGACY_BLOG_LANG_CODES = [
  "de-LI", "en-AU", "en-CA", "en-IE", "en-IN", "en-NZ", "en-ZA",
  "es-CL", "es-CO", "es-CR", "es-HN", "es-MX", "es-PE", "es-US", "es-UY", "es-VE",
  "ckb", "fil", "fr-CH", "gd", "haw", "hi", "ht", "ia", "id", "it-CH", "ku", "lg", "lo",
  "nn", "nso", "ro-MD", "so", "sr", "vi", "zu",
] as const;

export const postTranslationSchema = z.object({
  lang: z.enum([...BLOG_LANG_CODES, ...LEGACY_BLOG_LANG_CODES]),
  title: z.string(),
  excerpt: z.string().nullable().optional(),
  body_html: z.string().default(""),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
});

export function retainedBlogTranslations<T extends { lang: string }>(translations: T[], sourceLang: string): T[] {
  return translations.filter((translation) =>
    translation.lang !== sourceLang && !BLOG_LANG_CODES.includes(translation.lang),
  );
}