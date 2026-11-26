import type { Lang } from "./lang-match";
import { applyDeepDictOverlay } from "./app-ext-langs";
import { isLang } from "./lang-match";

export const LANDING_ENTRY_COPY: Record<Lang, { access: string; tryBelow: string }> = {
  pt: { access: "Acesse o app grátis", tryBelow: "...ou teste grátis abaixo" },
  "pt-PT": { access: "Aceda à app grátis", tryBelow: "...ou experimente grátis abaixo" },
  en: { access: "Access the app for free", tryBelow: "...or try it free below" },
  es: { access: "Accede a la app gratis", tryBelow: "...o pruébala gratis abajo" },
  fr: { access: "Accédez à l’app gratuitement", tryBelow: "...ou essayez gratuitement ci-dessous" },
  it: { access: "Accedi all’app gratis", tryBelow: "...oppure provala gratis qui sotto" },
  de: { access: "Nutze die App kostenlos", tryBelow: "...oder teste sie unten kostenlos" },
};

export function landingEntryCopy(
  lang: string,
  overlay?: Record<string, string>,
): { access: string; tryBelow: string } {
  if (isLang(lang)) return LANDING_ENTRY_COPY[lang];
  return overlay
    ? applyDeepDictOverlay(LANDING_ENTRY_COPY.en, overlay, "landingEntry")
    : LANDING_ENTRY_COPY.en;
}
