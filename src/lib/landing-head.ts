import { ALL_LANGS } from "./lang-match";
import { landingCopy } from "./landing-content";
const BASE = "https://flashpilot.net";
export const landingUrl = (lang?: string) =>
  lang ? `${BASE}/?lang=${encodeURIComponent(lang)}` : `${BASE}/`;
export function landingHead(lang: string, explicit = false) {
  const c = landingCopy(lang);
  const title = `FlashPilot — Home · ${landingSubtitle(lang)}`;
  const url = landingUrl(explicit ? lang : undefined);
  return {
    meta: [
      { title },
      { name: "description", content: c.ecosystemIntro },
      { property: "og:title", content: title },
      { property: "og:description", content: c.ecosystemIntro },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: url },
      ...ALL_LANGS.map((l) => ({
        rel: "alternate",
        hrefLang: l === "pt" ? "pt-BR" : l,
        href: landingUrl(l),
      })),
      { rel: "alternate", hrefLang: "x-default", href: landingUrl() },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              name: "FlashPilot",
              applicationCategory: "EducationalApplication",
              operatingSystem: "Web, Android, iOS",
              url,
              inLanguage: lang,
              description: c.ecosystemIntro,
            },
            {
              "@type": "FAQPage",
              mainEntity: c.faq.map(([q, a]) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
              })),
            },
          ],
        }),
      },
    ],
  };
}
export const LANDING_SUBTITLE: Record<string, string> = {
  pt: "Flashcards com revisão espaçada",
  "pt-PT": "Flashcards com revisão espaçada",
  en: "Spaced repetition flashcards",
  es: "Flashcards con repetición espaciada",
  fr: "Flashcards à répétition espacée",
  it: "Flashcard con ripetizione dilazionata",
  de: "Karteikarten mit verteilter Wiederholung",
};
export const landingSubtitle = (lang: string, overlay?: Record<string, string>) =>
  overlay?.["landing.headSubtitle"] ?? LANDING_SUBTITLE[lang] ?? LANDING_SUBTITLE.en!;
