import { z } from "zod";

export const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Shared by the editor, server validation and sitemap; never decode URL input. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidBlogSlug(value: unknown): value is string {
  return typeof value === "string" && BLOG_SLUG_PATTERN.test(value);
}

/** UI-only fallback: server inputs that normalize to empty are rejected. */
export function safeBlogSlug(value: string, fallback: string): string {
  return slugify(value) || slugify(fallback) || "post";
}

export const blogSlugSchema = z.string().transform(slugify).pipe(
  z.string().trim().min(1).regex(BLOG_SLUG_PATTERN),
);