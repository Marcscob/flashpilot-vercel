import { matchBlogTag } from "../blog-langs";
import { extraSignupCopy, welcomeTranslation } from "./welcome-extra-copy";

export type EmailLang = "pt" | "pt-PT" | "en" | "es" | "fr" | "it" | "de";

export interface SignupCopy {
  htmlLang: string;
  subject: string;
  preview: string;
  title: string;
  intro1: string;
  intro2: string;
  confirm: string;
  proKicker: string;
  proText: string;
  store: string;
  terms: string;
  privacy: string;
  ignore: string;
  tagline: string;
}

const pt: SignupCopy = {
  htmlLang: "pt-BR",
  subject: "Bem-vindo(a) ao {site} — confirme seu e-mail e comece seus 15 dias de teste grátis",
  preview: "Bem-vindo(a) ao {site} — confirme seu e-mail e libere seu kit de boas-vindas",
  title: "Bem-vindo(a) à comunidade {site}!",
  intro1: "Que bom ter você aqui. Confirme seu e-mail (",
  intro2: ") para ativar sua conta e começar a estudar.",
  confirm: "Confirmar meu e-mail",
  proKicker: "VÁ ALÉM COM O PRO",
  proText:
    "Na Loja você assina o plano Pro — limites muito maiores de flashcards, mapas mentais, formatações e conversação com o tutor — e compra pacotes de FlashCoins e matérias oficiais prontas.",
  store: "Ver planos e a Loja",
  terms: "Termos de Uso",
  privacy: "Política de Privacidade",
  ignore: "Se você não criou uma conta, pode ignorar este e-mail com segurança.",
  tagline: "Aprenda e nunca esqueça.",
};

const COPY: Record<EmailLang, SignupCopy> = {
  pt,
  "pt-PT": {
    ...pt,
    htmlLang: "pt-PT",
    subject: "Bem-vindo(a) ao {site} — confirme o seu e-mail e receba o seu kit de boas-vindas",
    preview: "Bem-vindo(a) ao {site} — confirme o seu e-mail e desbloqueie o seu kit",
    intro1: "É ótimo tê-lo(a) connosco. Confirme o seu e-mail (",
    intro2: ") para ativar a sua conta e começar a estudar.",
    confirm: "Confirmar o meu e-mail",
    proText:
      "Na Loja pode subscrever o plano Pro — limites muito maiores de flashcards, mapas mentais, formatações e conversação com o tutor — e comprar pacotes de FlashCoins e disciplinas oficiais prontas.",
    ignore: "Se não criou uma conta, pode ignorar este e-mail em segurança.",
    tagline: "Aprenda e nunca esqueça.",
  },
  en: {
    htmlLang: "en",
    subject: "Welcome to {site} — confirm your email and get your welcome kit",
    preview: "Welcome to {site} — confirm your email and unlock your welcome kit",
    title: "Welcome to the {site} community!",
    intro1: "Great to have you here. Confirm your email address (",
    intro2: ") to activate your account and start studying.",
    confirm: "Confirm my email",
    proKicker: "GO FURTHER WITH PRO",
    proText:
      "In the Store you can subscribe to the Pro plan — much larger allowances for flashcards, mind maps, note formatting and tutor conversation — and buy FlashCoin packs and ready-made official subjects.",
    store: "See plans and the Store",
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    ignore: "If you didn't create an account, you can safely ignore this email.",
    tagline: "Learn and never forget.",
  },
  es: {
    htmlLang: "es",
    subject: "Bienvenido(a) a {site} — confirma tu correo y recibe tu kit de bienvenida",
    preview: "Bienvenido(a) a {site} — confirma tu correo y desbloquea tu kit de bienvenida",
    title: "¡Bienvenido(a) a la comunidad {site}!",
    intro1: "Qué bueno tenerte aquí. Confirma tu correo (",
    intro2: ") para activar tu cuenta y empezar a estudiar.",
    confirm: "Confirmar mi correo",
    proKicker: "VE MÁS ALLÁ CON PRO",
    proText:
      "En la Tienda puedes suscribirte al plan Pro — límites mucho mayores de flashcards, mapas mentales, formateos y conversación con el tutor — y comprar paquetes de FlashCoins y materias oficiales listas.",
    store: "Ver planes y la Tienda",
    terms: "Términos de uso",
    privacy: "Política de Privacidad",
    ignore: "Si no creaste una cuenta, puedes ignorar este correo con tranquilidad.",
    tagline: "Aprende y nunca olvides.",
  },
  fr: {
    htmlLang: "fr",
    subject: "Bienvenue sur {site} — confirmez votre e-mail et recevez votre kit de bienvenue",
    preview: "Bienvenue sur {site} — confirmez votre e-mail et débloquez votre kit",
    title: "Bienvenue dans la communauté {site} !",
    intro1: "Ravi de vous compter parmi nous. Confirmez votre adresse e-mail (",
    intro2: ") pour activer votre compte et commencer à étudier.",
    confirm: "Confirmer mon e-mail",
    proKicker: "ALLEZ PLUS LOIN AVEC PRO",
    proText:
      "Dans la Boutique, abonnez-vous au plan Pro — des limites bien plus élevées de flashcards, cartes mentales, mises en forme et conversation avec le tuteur — et achetez des packs de FlashCoins et des matières officielles prêtes.",
    store: "Voir les offres et la Boutique",
    terms: "Conditions d'utilisation",
    privacy: "Politique de confidentialité",
    ignore: "Si vous n'avez pas créé de compte, vous pouvez ignorer cet e-mail.",
    tagline: "Apprenez et n’oubliez jamais.",
  },
  it: {
    htmlLang: "it",
    subject: "Benvenuto(a) su {site} — conferma la tua email e ricevi il kit di benvenuto",
    preview: "Benvenuto(a) su {site} — conferma la tua email e sblocca il tuo kit",
    title: "Benvenuto(a) nella community {site}!",
    intro1: "Che bello averti qui. Conferma il tuo indirizzo email (",
    intro2: ") per attivare il tuo account e iniziare a studiare.",
    confirm: "Conferma la mia email",
    proKicker: "VAI OLTRE CON PRO",
    proText:
      "Nello Store puoi abbonarti al piano Pro — limiti molto più alti per flashcard, mappe mentali, formattazioni e conversazione con il tutor — e acquistare pacchetti di FlashCoins e materie ufficiali pronte.",
    store: "Vedi i piani e lo Store",
    terms: "Termini d'uso",
    privacy: "Informativa sulla privacy",
    ignore: "Se non hai creato un account, puoi ignorare questa email.",
    tagline: "Impara e non dimenticare mai.",
  },
  de: {
    htmlLang: "de",
    subject: "Willkommen bei {site} — bestätige deine E-Mail und erhalte dein Willkommenspaket",
    preview:
      "Willkommen bei {site} — bestätige deine E-Mail und schalte dein Willkommenspaket frei",
    title: "Willkommen in der {site}-Community!",
    intro1: "Schön, dass du da bist. Bestätige deine E-Mail-Adresse (",
    intro2: "), um dein Konto zu aktivieren und mit dem Lernen zu beginnen.",
    confirm: "Meine E-Mail bestätigen",
    proKicker: "MEHR MIT PRO",
    proText:
      "Im Shop kannst du den Pro-Plan abonnieren — deutlich höhere Kontingente für Karteikarten, Mindmaps, Formatierungen und Tutor-Gespräche — sowie FlashCoin-Pakete und fertige offizielle Fächer kaufen.",
    store: "Pläne und Shop ansehen",
    terms: "Nutzungsbedingungen",
    privacy: "Datenschutzerklärung",
    ignore: "Falls du kein Konto erstellt hast, kannst du diese E-Mail ignorieren.",
    tagline: "Lernen und nie vergessen.",
  },
};

export function normalizeLang(raw: string | null | undefined): EmailLang {
  if (!raw) return "pt";
  const v = raw.trim();
  const low = v.toLowerCase();
  if (low === "pt-pt") return "pt-PT";
  const base = low.split(/[-_]/)[0];
  if (base === "pt") return "pt";
  if (base === "en" || base === "es" || base === "fr" || base === "it" || base === "de")
    return base;
  return "pt";
}

function langFromUrl(url: string | null | undefined, depth = 0): string | null {
  if (!url || depth > 3) return null;
  try {
    const parsed = new URL(url, "https://flashpilot.net");
    const direct = parsed.searchParams.get("lang");
    if (direct && matchBlogTag(direct)) return resolveWelcomeLang(direct);
    for (const key of ["redirect_to", "callback_url"]) {
      const nested = langFromUrl(parsed.searchParams.get(key), depth + 1);
      if (nested) return nested;
    }
  } catch {
    return null;
  }
  return null;
}

/** Reads the locale from either auth action link or its callback URL. */
export function langFromConfirmationUrl(
  url: string | null | undefined,
  callbackUrl?: string | null,
): string {
  return langFromUrl(url) ?? langFromUrl(callbackUrl) ?? "en";
}

export function resolveWelcomeLang(raw: string | null | undefined): string {
  if (!raw || !matchBlogTag(raw)) return "en";
  try {
    return Intl.getCanonicalLocales(raw.replaceAll("_", "-"))[0] ?? "en";
  } catch {
    return "en";
  }
}

export function signupCopy(lang: string, site: string): SignupCopy {
  const locale = resolveWelcomeLang(lang);
  const extra = extraSignupCopy(locale, site);
  if (extra) return extra;
  const key = normalizeLang(matchBlogTag(locale));
  const c = COPY[key] ?? COPY.en;
  const f = (s: string) => s.replace(/\{site\}/g, site);
  const regional = (s: string) => (locale === "de-CH" ? s.replaceAll("ß", "ss") : s);
  return {
    ...c,
    htmlLang: locale === "pt" ? "pt-BR" : locale,
    subject: regional(f(c.subject)),
    preview: regional(f(c.preview)),
    title: regional(f(c.title)),
    intro1: regional(c.intro1),
    intro2: regional(c.intro2),
    confirm: regional(c.confirm),
  };
}

/**
 * Boas-vindas para quem entra por um provedor social (Google): a conta já chega
 * com o e-mail verificado, então não há botão de confirmação — apenas a saudação,
 * o kit inicial e o convite à Loja.
 */
export interface WelcomeCopy extends Omit<SignupCopy, "intro1" | "intro2" | "confirm" | "ignore"> {
  intro: string;
  cta: string;
  note: string;
}

const WELCOME_OVERRIDES: Record<
  EmailLang,
  Pick<WelcomeCopy, "subject" | "preview" | "intro" | "cta" | "note">
> = {
  pt: {
    subject: "Bem-vindo(a) ao {site}! Seus 15 dias de teste grátis começaram",
    preview: "Sua conta está pronta e o kit de boas-vindas já está na sua conta.",
    intro:
      "Que bom ter você aqui! Sua conta já está ativa e o kit de boas-vindas está disponível para você começar agora mesmo.",
    cta: "Começar a estudar",
    note: "Você recebeu este e-mail porque criou uma conta no {site}.",
  },
  "pt-PT": {
    subject: "Bem-vindo(a) ao {site}! O seu kit de boas-vindas já está ativo",
    preview: "A sua conta está pronta e o kit de boas-vindas já está na sua conta.",
    intro:
      "É ótimo tê-lo(a) connosco! A sua conta já está ativa e o kit de boas-vindas está disponível para começar agora mesmo.",
    cta: "Começar a estudar",
    note: "Recebeu este e-mail porque criou uma conta no {site}.",
  },
  en: {
    subject: "Welcome to {site}! Your 15-day free trial has started",
    preview: "Your account is ready and your welcome kit is already in it.",
    intro:
      "Great to have you here! Your account is active and your welcome kit is ready, so you can start right away.",
    cta: "Start studying",
    note: "You received this email because you created a {site} account.",
  },
  es: {
    subject: "¡Bienvenido(a) a {site}! Tu prueba gratuita de 15 días ha comenzado",
    preview: "Tu cuenta está lista y el kit de bienvenida ya está en ella.",
    intro:
      "¡Qué bueno tenerte aquí! Tu cuenta ya está activa y tu kit de bienvenida está disponible para empezar ahora mismo.",
    cta: "Empezar a estudiar",
    note: "Recibes este correo porque creaste una cuenta en {site}.",
  },
  fr: {
    subject: "Bienvenue sur {site} ! Votre kit de bienvenue est prêt",
    preview: "Votre compte est prêt et votre kit de bienvenue y est déjà.",
    intro:
      "Ravi de vous compter parmi nous ! Votre compte est actif et votre kit de bienvenue est disponible : vous pouvez commencer tout de suite.",
    cta: "Commencer à étudier",
    note: "Vous recevez cet e-mail car vous avez créé un compte {site}.",
  },
  it: {
    subject: "Benvenuto(a) su {site}! Il tuo kit di benvenuto è attivo",
    preview: "Il tuo account è pronto e il kit di benvenuto è già disponibile.",
    intro:
      "Che bello averti qui! Il tuo account è attivo e il kit di benvenuto è disponibile: puoi iniziare subito.",
    cta: "Inizia a studiare",
    note: "Ricevi questa email perché hai creato un account {site}.",
  },
  de: {
    subject: "Willkommen bei {site}! Dein Willkommenspaket ist aktiv",
    preview: "Dein Konto ist bereit und dein Willkommenspaket liegt schon darin.",
    intro:
      "Schön, dass du da bist! Dein Konto ist aktiv und dein Willkommenspaket steht bereit — du kannst sofort loslegen.",
    cta: "Jetzt lernen",
    note: "Du erhältst diese E-Mail, weil du ein {site}-Konto erstellt hast.",
  },
};

export function welcomeCopy(lang: string, site: string): WelcomeCopy {
  const base = signupCopy(lang, site);
  const row = welcomeTranslation(lang);
  if (row)
    return {
      ...base,
      subject: base.title,
      preview: row.extra[0] ?? "",
      cta: row.u["Começar a estudar"] ?? "",
      intro: row.extra[0] ?? "",
      note: "",
    };
  const over = WELCOME_OVERRIDES[normalizeLang(matchBlogTag(lang))] ?? WELCOME_OVERRIDES.en;
  const f = (s: string) => s.replace(/\{site\}/g, site);
  return {
    htmlLang: base.htmlLang,
    title: f(base.title),
    proKicker: base.proKicker,
    proText: base.proText,
    store: base.store,
    terms: base.terms,
    privacy: base.privacy,
    tagline: base.tagline,
    subject: f(over.subject),
    preview: f(over.preview),
    intro: f(over.intro),
    cta: over.cta,
    note: f(over.note),
  };
}
