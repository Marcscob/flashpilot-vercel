/**
 * Contas do Instagram do FlashPilot e os idiomas que cada uma cobre.
 * As publicações são feitas via Meta Graph API em 2 passos:
 * 1. POST /{ig_user_id}/media (criação de container com image_url e caption)
 * 2. POST /{ig_user_id}/media_publish (disparo para o feed)
 *
 * O token e o ID da conta ficam APENAS no servidor.
 */
import { blogPostCanonicalUrl } from "./blog-facebook";

export type InstagramAccountKey = "br" | "pt" | "en" | "es" | "latam" | "fr" | "de" | "it";

export type InstagramAccountInfo = {
  key: InstagramAccountKey;
  accountName: string;
  /** Chave da página correspondente no Facebook vinculada no Meta Business Suite */
  facebookPageKey: string;
  /** Nome da variável de ambiente com o ID da conta do Instagram (opcional se puder descobrir via page) */
  accountIdEnv: string;
  /** Nome da variável com o token (usa o token da página do Facebook com permissão instagram_content_publish) */
  tokenEnv: string;
  /** Códigos do blog atendidos por esta conta, em ordem de preferência */
  langs: string[];
};

export const INSTAGRAM_ACCOUNTS: InstagramAccountInfo[] = [
  { key: "br", accountName: "flashpilot.br", facebookPageKey: "br", accountIdEnv: "IG_ACCOUNT_ID_BR", tokenEnv: "FB_PAGE_TOKEN_BR", langs: ["pt-BR", "pt"] },
  { key: "pt", accountName: "flashpilot.pt", facebookPageKey: "pt", accountIdEnv: "IG_ACCOUNT_ID_PT", tokenEnv: "FB_PAGE_TOKEN_PT", langs: ["pt-PT", "pt"] },
  { key: "en", accountName: "flashpilot.en", facebookPageKey: "en", accountIdEnv: "IG_ACCOUNT_ID_EN", tokenEnv: "FB_PAGE_TOKEN_EN", langs: ["en", "en-GB"] },
  { key: "es", accountName: "flashpilot.es", facebookPageKey: "es", accountIdEnv: "IG_ACCOUNT_ID_ES", tokenEnv: "FB_PAGE_TOKEN_ES", langs: ["es-ES", "es"] },
  { key: "latam", accountName: "flashpilot.latam", facebookPageKey: "latam", accountIdEnv: "IG_ACCOUNT_ID_LATAM", tokenEnv: "FB_PAGE_TOKEN_LATAM", langs: ["es", "es-AR"] },
  { key: "fr", accountName: "flashpilot.fr", facebookPageKey: "fr", accountIdEnv: "IG_ACCOUNT_ID_FR", tokenEnv: "FB_PAGE_TOKEN_FR", langs: ["fr", "fr-CA"] },
  { key: "de", accountName: "flashpilot.de", facebookPageKey: "de", accountIdEnv: "IG_ACCOUNT_ID_DE", tokenEnv: "FB_PAGE_TOKEN_DE", langs: ["de", "de-AT", "de-CH"] },
  { key: "it", accountName: "flashpilot.it", facebookPageKey: "it", accountIdEnv: "IG_ACCOUNT_ID_IT", tokenEnv: "FB_PAGE_TOKEN_IT", langs: ["it"] },
];

/** Hashtags adaptadas por idioma */
const HASHTAGS: Record<string, string> = {
  pt: "#flashpilot #flashcards #estudos #memorizacao #concursos #aprendizado",
  "pt-BR": "#flashpilot #flashcards #estudos #memorizacao #concursos #enem #oab",
  "pt-PT": "#flashpilot #flashcards #estudos #memorizacao #ensinosuperior #aprendizagem",
  en: "#flashpilot #flashcards #spacedrepetition #studymethod #learning #studytips",
  es: "#flashpilot #flashcards #estudio #memorizacion #tecnicasdeestudio #aprendizaje",
  fr: "#flashpilot #flashcards #etudes #memorisation #apprentissage #repetitionespacee",
  de: "#flashpilot #karteikarten #lernen #lernmethoden #spationierung #studium",
  it: "#flashpilot #flashcard #studio #memorizzazione #metododistudio #apprendimento",
};

/**
 * Monta a legenda (caption) adaptada ao Instagram:
 * 1. Título impactante
 * 2. Resumo explicativo
 * 3. Chamada clara para o link no perfil / flashpilot.net
 * 4. Hashtags segmentadas
 */
export function buildInstagramCaption(excerpt: string | null, title: string, lang: string, slug: string): string {
  const summary = (excerpt ?? "").trim() || title.trim();
  const base = lang.split("-")[0] ?? "en";
  const tags = HASHTAGS[lang] ?? HASHTAGS[base] ?? HASHTAGS.en;
  const link = blogPostCanonicalUrl(lang, slug);

  let cta = "🔗 Leia o artigo completo no link da bio ou em flashpilot.net";
  if (base === "en") cta = "🔗 Read the full article at the link in bio or flashpilot.net";
  else if (base === "es") cta = "🔗 Lee el artículo completo en el enlace de la bio o en flashpilot.net";
  else if (base === "fr") cta = "🔗 Lisez l'article complet via le lien en bio ou sur flashpilot.net";
  else if (base === "de") cta = "🔗 Lies den vollständigen Artikel über den Link in der Bio oder auf flashpilot.net";
  else if (base === "it") cta = "🔗 Leggi l'articolo completo al link in bio o su flashpilot.net";

  return `${title.trim()}\n\n${summary}\n\n${cta}\n\n${link}\n\n${tags}`;
}
