import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolveBlogUiLocale, translateBlogUi } from "../src/lib/blog-ui-i18n";

const source = "Voltar ao blog";

describe("blog UI localization", () => {
  test("regional blog locales use their native UI language", () => {
    expect(resolveBlogUiLocale("de-AT")).toEqual({ lang: "de", extLang: null });
    expect(translateBlogUi(source, "de")).not.toBe(source);
  });

  test("extra blog locales use their on-demand overlay", () => {
    const overlay = JSON.parse(
      readFileSync(new URL("../public/i18n/tk.json", import.meta.url), "utf8"),
    ) as { u: Record<string, string> };

    expect(resolveBlogUiLocale("tk")).toEqual({ lang: "en", extLang: "tk" });
    expect(overlay.u[source]).toBeTruthy();
    expect(translateBlogUi(source, "en", overlay.u)).toBe(overlay.u[source]);
  });
});
