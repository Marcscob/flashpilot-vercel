import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import {
  APP_EXT_LANGS,
  applyDictOverlay,
  applyDeepDictOverlay,
  matchAppAcceptLanguage,
  matchAppLocale,
  nativeFor,
  resolveManualAppLocale,
} from "../src/lib/app-ext-langs";
import { BLOG_LANGS } from "../src/lib/blog-langs";
import { landingCopy } from "../src/lib/landing-content";
import { landingEntryCopy } from "../src/lib/landing-entry-copy";
import { landingLegacyCopy } from "../src/lib/landing-copy";
import { landingPilotCopy } from "../src/lib/landing-pilot-copy";
import { ledgerCopy } from "../src/lib/ledger-labels";
import { refundCopy } from "../src/lib/refund-copy";

test("matches the first supported locale across browser preferences", () => {
  expect(matchAppLocale(["xx-YY", "ja-JP", "en-US"])).toEqual({ lang: "en", extLang: "ja" });
  expect(matchAppLocale(["fr-CA", "ja-JP"])).toEqual({ lang: "fr", extLang: null });
});

test("normalizes regional variants and script tags to catalog locales", () => {
  expect(matchAppLocale(["es-MX"])).toEqual({ lang: "es", extLang: null });
  expect(matchAppLocale(["zh-Hant-TW"])).toEqual({ lang: "en", extLang: "zh-TW" });
  expect(matchAppLocale(["uk-UA"])).toEqual({ lang: "en", extLang: "uk" });
});

test("automatically resolves every advertised app locale from browser and request headers", () => {
  expect(BLOG_LANGS).toHaveLength(52);
  for (const { code } of BLOG_LANGS) {
    const native = nativeFor(code);
    const expected = native ? { lang: native, extLang: null } : { lang: "en", extLang: code };
    expect(matchAppLocale([code])).toEqual(expected);
    expect(matchAppAcceptLanguage(`${code},en;q=0.5`)).toEqual(expected);
  }
});

test("orders Accept-Language values by quality and ignores excluded tags", () => {
  expect(matchAppAcceptLanguage("xx;q=0.9,uk;q=0.8,ja;q=0.7")).toEqual({
    lang: "en",
    extLang: "uk",
  });
  expect(matchAppAcceptLanguage("ja;q=0,xx;q=0")).toEqual({ lang: "en", extLang: null });
});

test("a saved manual locale takes precedence over browser language", () => {
  expect(resolveManualAppLocale(true, "en", "ja")).toEqual({ lang: "en", extLang: "ja" });
  expect(resolveManualAppLocale(true, "fr", "ja")).toEqual({ lang: "fr", extLang: null });
  expect(resolveManualAppLocale(false, "fr", null)).toBeNull();
  expect(resolveManualAppLocale(true, "invalid", "ja")).toBeNull();
});

test("deep overlays translate nested landing strings and indexed array values", () => {
  const source = { heading: "Heading", cards: [["Question", "Answer"]] };
  expect(
    applyDeepDictOverlay(
      source,
      { "landing.heading": "Localized", "landing.cards.0.1": "Réponse" },
      "landing",
    ),
  ).toEqual({ heading: "Localized", cards: [["Question", "Réponse"]] });
});

test("dictionary overlays translate arrays and callback-generated legal sections", () => {
  const source = {
    actions: ["Study", "Review"],
    legal: {
      terms: {
        sections: (contact: { email: string }) => [{ p: `Contact us at ${contact.email}.` }],
      },
    },
  };
  const localized = applyDictOverlay(source, {
    "actions.0": "Aprender",
    "actions.1": "Revisar",
    "legal.terms.sections.0.p": "お問い合わせ: {email}",
  });
  expect(localized.actions).toEqual(["Aprender", "Revisar"]);
  expect(localized.legal.terms.sections({ email: "help@example.test" })).toEqual([
    { p: "お問い合わせ: help@example.test" },
  ]);
});

test("dictionary overlays translate positional callback arguments", () => {
  const source = {
    pricing: {
      monthlyCards: (count: string) => `${count} cards per month`,
    },
  };
  const localized = applyDictOverlay(source, {
    "pricing.monthlyCards": "{arg0} localized cards per month",
  });
  expect(localized.pricing.monthlyCards("700")).toBe("700 localized cards per month");
});

test("extra locale overlays translate all refund policy sections", () => {
  const copy = refundCopy("ru", {
    "refund.policyTitle": "Политика возврата",
    "refund.sections.0.h": "1. Обязательства",
    "refund.sections.2.p": "Свяжитесь с нами: {email}.",
  });
  expect(copy.policyTitle).toBe("Политика возврата");
  expect(copy.sections[0]?.h).toBe("1. Обязательства");
  expect(copy.sections[2]?.p).toBe("Свяжитесь с нами: {email}.");
});

test("extra locale overlays translate FlashCoins ledger descriptions", () => {
  const copy = ledgerCopy("ru", {
    "ledger.purchase.title": "Покупка FlashCoins",
    "ledger.statementHint": "Описание баланса",
  });
  expect(copy.purchase.title).toBe("Покупка FlashCoins");
  expect(copy.statementHint).toBe("Описание баланса");
  expect(copy.subscription.detail).toBe(ledgerCopy("en").subscription.detail);
});

test("extra locales overlay translated landing strings and fall back to English", () => {
  const overlay = {
    "landing.tagline": "Localized tagline",
    "landingCapture.headlineStart": "Localized capture headline",
    "landingEntry.access": "Localized access",
    "landingPilot.label": "Localized ImagePilot",
    "pwa.title": "Localized install title",
  };
  expect(landingCopy("ja", overlay).tagline).toBe("Localized tagline");
  expect(landingCopy("ja", overlay).techLabel).toBe(landingCopy("en").techLabel);
  expect(landingLegacyCopy("ja", overlay).headlineStart).toBe("Localized capture headline");
  expect(landingEntryCopy("ja", overlay).access).toBe("Localized access");
  expect(landingPilotCopy("ja", overlay).label).toBe("Localized ImagePilot");
});

test("every active extra locale has a valid lazy-loaded dictionary", () => {
  for (const { code } of APP_EXT_LANGS) {
    const data = JSON.parse(
      readFileSync(new URL(`../public/i18n/${code}.json`, import.meta.url), "utf8"),
    );
    expect(data).toMatchObject({ d: expect.any(Object), u: expect.any(Object) });
  }
});
