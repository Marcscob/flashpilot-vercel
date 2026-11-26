import * as React from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { resolveWelcomeLang, type EmailLang } from "./signup-i18n";
import { welcomeDirection } from "../welcome-locale";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "FlashPilot";
const SITE_URL = "https://flashpilot.net";

type ReminderCopy = {
  htmlLang: string;
  preview: string;
  title: string;
  body: (date: string) => string;
  cta: string;
  expiry: string;
  subject: string;
};

const COPY: Record<string, ReminderCopy> = {
  pt: {
    htmlLang: "pt-BR",
    preview: "Seus flashcards estão disponíveis na sua conta",
    title: "Você já possui conta no Flashpilot",
    body: (d) =>
      `Os flashcards criados por você em ${d} estão disponíveis na sua conta. Para acessá-los clique no link abaixo.`,
    cta: "Acessar meus flashcards",
    expiry: "Este link é pessoal e expira em breve. Se expirar, peça um novo na página de entrada.",
    subject: "Seus flashcards estão esperando na sua conta Flashpilot",
  },
  "pt-PT": {
    htmlLang: "pt-PT",
    preview: "Os seus flashcards estão disponíveis na sua conta",
    title: "Já possui conta no Flashpilot",
    body: (d) =>
      `Os flashcards criados por si em ${d} estão disponíveis na sua conta. Para aceder, clique na ligação abaixo.`,
    cta: "Aceder aos meus flashcards",
    expiry:
      "Esta ligação é pessoal e expira em breve. Se expirar, peça uma nova na página de entrada.",
    subject: "Os seus flashcards estão à espera na sua conta Flashpilot",
  },
  en: {
    htmlLang: "en",
    preview: "Your flashcards are available in your account",
    title: "You already have a Flashpilot account",
    body: (d) =>
      `The flashcards you created on ${d} are available in your account. To access them, click the link below.`,
    cta: "Open my flashcards",
    expiry:
      "This link is personal and expires soon. If it expires, request a new one on the sign-in page.",
    subject: "Your flashcards are waiting in your Flashpilot account",
  },
  es: {
    htmlLang: "es",
    preview: "Tus flashcards están disponibles en tu cuenta",
    title: "Ya tienes una cuenta en Flashpilot",
    body: (d) =>
      `Las flashcards que creaste el ${d} están disponibles en tu cuenta. Para acceder a ellas, haz clic en el enlace de abajo.`,
    cta: "Abrir mis flashcards",
    expiry:
      "Este enlace es personal y caduca pronto. Si caduca, solicita uno nuevo en la página de acceso.",
    subject: "Tus flashcards te esperan en tu cuenta de Flashpilot",
  },
  fr: {
    htmlLang: "fr",
    preview: "Vos flashcards sont disponibles dans votre compte",
    title: "Vous avez déjà un compte Flashpilot",
    body: (d) =>
      `Les flashcards que vous avez créées le ${d} sont disponibles dans votre compte. Pour y accéder, cliquez sur le lien ci-dessous.`,
    cta: "Ouvrir mes flashcards",
    expiry:
      "Ce lien est personnel et expire bientôt. S'il expire, demandez-en un nouveau sur la page de connexion.",
    subject: "Vos flashcards vous attendent dans votre compte Flashpilot",
  },
  it: {
    htmlLang: "it",
    preview: "Le tue flashcard sono disponibili nel tuo account",
    title: "Hai già un account Flashpilot",
    body: (d) =>
      `Le flashcard che hai creato il ${d} sono disponibili nel tuo account. Per accedervi, clicca sul link qui sotto.`,
    cta: "Apri le mie flashcard",
    expiry:
      "Questo link è personale e scade a breve. Se scade, richiedine uno nuovo dalla pagina di accesso.",
    subject: "Le tue flashcard ti aspettano nel tuo account Flashpilot",
  },
  de: {
    htmlLang: "de",
    preview: "Deine Karteikarten sind in deinem Konto verfügbar",
    title: "Du hast bereits ein Flashpilot-Konto",
    body: (d) =>
      `Die Karteikarten, die du am ${d} erstellt hast, sind in deinem Konto verfügbar. Klicke auf den Link unten, um darauf zuzugreifen.`,
    cta: "Meine Karteikarten öffnen",
    expiry:
      "Dieser Link ist persönlich und läuft bald ab. Fordere bei Bedarf auf der Anmeldeseite einen neuen an.",
    subject: "Deine Karteikarten warten in deinem Flashpilot-Konto",
  },
};

interface LandingReminderEmailProps {
  lang?: EmailLang | string;
  magicLinkUrl: string;
  createdAt?: string;
}

function formatDate(iso: string | undefined, locale: string): string {
  const date = iso ? new Date(iso) : new Date();
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeZone: "America/Sao_Paulo",
    }).format(Number.isNaN(date.getTime()) ? new Date() : date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export const LandingReminderEmail = ({
  lang = "pt",
  magicLinkUrl,
  createdAt,
}: LandingReminderEmailProps) => {
  const locale = resolveWelcomeLang(String(lang));
  const c = COPY[locale] ?? COPY.en;
  return (
    <Html lang={c.htmlLang} dir={welcomeDirection(locale)}>
      <Head />
      <Preview>{c.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoWrap}>
            <Img src={`${SITE_URL}/flashpilot-logo.png`} alt={SITE_NAME} width="280" style={logo} />
          </Section>
          <Section style={card}>
            <Heading style={h1}>{c.title}</Heading>
            <Text style={text}>{c.body(formatDate(createdAt, c.htmlLang))}</Text>
            <Section style={buttonWrap}>
              <Button className="dm-btn" style={button} href={magicLinkUrl}>
                {c.cta}
              </Button>
            </Section>
            <Hr style={hr} />
            <Text style={muted}>{c.expiry}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: LandingReminderEmail,
  subject: (data: Record<string, any>) =>
    (COPY[resolveWelcomeLang(String(data?.lang ?? "pt"))] ?? COPY.en).subject,
  displayName: "Lembrete de flashcards da landing page",
  previewData: {
    lang: "pt",
    magicLinkUrl: "https://flashpilot.net/?resume=1",
    createdAt: "2026-11-03T12:00:00.000Z",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" };
const container = { margin: "0 auto", padding: "24px 16px", maxWidth: "560px" };
const logoWrap = { textAlign: "center" as const, paddingBottom: "16px" };
const logo = { margin: "0 auto" };
const card = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "28px 24px",
};
const h1 = { color: "#111827", fontSize: "22px", margin: "0 0 12px" };
const text = { color: "#374151", fontSize: "15px", lineHeight: "24px", margin: "0 0 20px" };
const buttonWrap = { textAlign: "center" as const, margin: "8px 0 20px" };
const button = {
  backgroundColor: "#4f46e5",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 28px",
  textDecoration: "none",
};
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
const muted = { color: "#6b7280", fontSize: "13px", lineHeight: "20px", margin: "0 0 6px" };
