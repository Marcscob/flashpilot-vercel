/**
 * Páginas do Facebook do FlashPilot e os idiomas do blog que cada uma cobre.
 * O access_token de cada página fica APENAS no servidor (variável de ambiente),
 * nunca no navegador.
 */
export type FacebookPageKey = "pt" | "br" | "en" | "es" | "latam" | "fr" | "de" | "it";

export type FacebookPageInfo = {
  key: FacebookPageKey;
  pageName: string;
  pageId: string;
  /** Nome da variável de ambiente com o access token da página. */
  tokenEnv: string;
  /** Códigos do blog atendidos por esta página, em ordem de preferência. */
  langs: string[];
};

export const FACEBOOK_PAGES: FacebookPageInfo[] = [
  { key: "pt", pageName: "Flashpilot.pt", pageId: "1385138404681253", tokenEnv: "FB_PAGE_TOKEN_PT", langs: ["pt", "pt-PT"] },
  { key: "br", pageName: "Flashpilot.br", pageId: "1264731993396184", tokenEnv: "FB_PAGE_TOKEN_BR", langs: ["pt-BR"] },
  { key: "en", pageName: "Flashpilot.en", pageId: "1432929529896375", tokenEnv: "FB_PAGE_TOKEN_EN", langs: ["en", "en-GB"] },
  { key: "es", pageName: "Flashpilot.es", pageId: "1397933883403571", tokenEnv: "FB_PAGE_TOKEN_ES", langs: ["es-ES"] },
  { key: "latam", pageName: "Flashpilot.latam", pageId: "1457574310764101", tokenEnv: "FB_PAGE_TOKEN_LATAM", langs: ["es", "es-AR"] },
  { key: "fr", pageName: "Flashpilot.fr", pageId: "1410800455444160", tokenEnv: "FB_PAGE_TOKEN_FR", langs: ["fr", "fr-CA"] },
  { key: "de", pageName: "Flashpilot.de", pageId: "1313138061894058", tokenEnv: "FB_PAGE_TOKEN_DE", langs: ["de", "de-AT", "de-CH"] },
  { key: "it", pageName: "Flashpilot.it", pageId: process.env.FB_PAGE_ID_IT ?? "1482819288924821", tokenEnv: "FB_PAGE_TOKEN_IT", langs: ["it"] },
];

/** URL canônica do post do blog no idioma informado. */
export function blogPostCanonicalUrl(lang: string, slug: string): string {
  return `https://flashpilot.net/${lang}/blog/${slug}`;
}

/**
 * Monta o texto da publicação: obrigatoriamente começa com
 * "flashpilot.net — " seguido do resumo (ou do título, se não houver resumo).
 */
export function buildFacebookMessage(excerpt: string | null, title: string): string {
  const summary = (excerpt ?? "").trim() || title.trim();
  return `flashpilot.net — ${summary}`;
}
