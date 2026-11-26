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

type ActivationCopy = {
  htmlLang: string;
  preview: string;
  title: string;
  intro: string;
  cta: string;
  expiry: string;
  ignore: string;
  subject: string;
};

const COPY: Record<string, ActivationCopy> = {
  pt: {
    htmlLang: "pt-BR",
    preview: "Confirme seu e-mail e defina sua senha para ver seus flashcards",
    title: "Seus flashcards estão quase prontos",
    intro:
      "Recebemos o texto que você enviou no FlashPilot. Para gerar seus flashcards com o PilotAI, confirme seu e-mail e crie sua senha no botão abaixo.",
    cta: "Ativar conta e estudar",
    expiry: "Este link é válido por 24 horas.",
    ignore: "Se você não fez este pedido, ignore este e-mail.",
    subject: "Ative sua conta e veja seus flashcards",
  },
  "pt-PT": {
    htmlLang: "pt-PT",
    preview: "Confirme o seu e-mail e defina a sua senha para ver os seus flashcards",
    title: "Os seus flashcards estão quase prontos",
    intro:
      "Recebemos o texto que enviou no FlashPilot. Para gerar os seus flashcards com o PilotAI, confirme o seu e-mail e crie a sua senha no botão abaixo.",
    cta: "Ativar conta e estudar",
    expiry: "Este link é válido por 24 horas.",
    ignore: "Se não fez este pedido, ignore este e-mail.",
    subject: "Ative a sua conta e veja os seus flashcards",
  },
  en: {
    htmlLang: "en",
    preview: "Confirm your email and set your password to see your flashcards",
    title: "Your flashcards are almost ready",
    intro:
      "We received the text you sent on FlashPilot. To generate your flashcards with PilotAI, confirm your email and create your password using the button below.",
    cta: "Activate account and study",
    expiry: "This link is valid for 24 hours.",
    ignore: "If you didn't make this request, ignore this email.",
    subject: "Activate your account and see your flashcards",
  },
  es: {
    htmlLang: "es",
    preview: "Confirma tu correo y define tu contraseña para ver tus flashcards",
    title: "Tus flashcards están casi listos",
    intro:
      "Recibimos el texto que enviaste en FlashPilot. Para generar tus flashcards con PilotAI, confirma tu correo y crea tu contraseña en el botón de abajo.",
    cta: "Activar cuenta y estudiar",
    expiry: "Este enlace es válido por 24 horas.",
    ignore: "Si no hiciste esta solicitud, ignora este correo.",
    subject: "Activa tu cuenta y mira tus flashcards",
  },
  fr: {
    htmlLang: "fr",
    preview: "Confirmez votre e-mail et définissez votre mot de passe pour voir vos flashcards",
    title: "Vos flashcards sont presque prêtes",
    intro:
      "Nous avons reçu le texte que vous avez envoyé sur FlashPilot. Pour générer vos flashcards avec PilotAI, confirmez votre e-mail et créez votre mot de passe via le bouton ci-dessous.",
    cta: "Activer mon compte et étudier",
    expiry: "Ce lien est valable 24 heures.",
    ignore: "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
    subject: "Activez votre compte et découvrez vos flashcards",
  },
  it: {
    htmlLang: "it",
    preview: "Conferma la tua e-mail e imposta la password per vedere le tue flashcard",
    title: "Le tue flashcard sono quasi pronte",
    intro:
      "Abbiamo ricevuto il testo che hai inviato su FlashPilot. Per generare le tue flashcard con PilotAI, conferma la tua e-mail e crea la password con il pulsante qui sotto.",
    cta: "Attiva l'account e studia",
    expiry: "Questo link è valido per 24 ore.",
    ignore: "Se non hai fatto tu questa richiesta, ignora questa e-mail.",
    subject: "Attiva il tuo account e guarda le tue flashcard",
  },
  de: {
    htmlLang: "de",
    preview: "Bestätige deine E-Mail und lege dein Passwort fest, um deine Karteikarten zu sehen",
    title: "Deine Karteikarten sind fast fertig",
    intro:
      "Wir haben den Text erhalten, den du bei FlashPilot gesendet hast. Um deine Karteikarten mit PilotAI zu erstellen, bestätige deine E-Mail und erstelle dein Passwort über die Schaltfläche unten.",
    cta: "Konto aktivieren und lernen",
    expiry: "Dieser Link ist 24 Stunden gültig.",
    ignore: "Wenn du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.",
    subject: "Aktiviere dein Konto und sieh deine Karteikarten",
  },
};

interface LandingActivationEmailProps {
  lang?: EmailLang | string;
  activationUrl: string;
  fullName?: string | null;
}

export const LandingActivationEmail = ({
  lang = "pt",
  activationUrl,
}: LandingActivationEmailProps) => {
  const locale = resolveWelcomeLang(String(lang));
  const c = COPY[locale] ?? COPY.pt;
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
            <Text style={text}>{c.intro}</Text>
            <Section style={buttonWrap}>
              <Button className="dm-btn" style={button} href={activationUrl}>
                {c.cta}
              </Button>
            </Section>
            <Hr style={hr} />
            <Text style={muted}>{c.expiry}</Text>
            <Text style={muted}>{c.ignore}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: LandingActivationEmail,
  subject: (data: Record<string, any>) =>
    (COPY[resolveWelcomeLang(String(data?.lang ?? "pt"))] ?? COPY.pt).subject,
  displayName: "Ativação da landing page",
  previewData: { lang: "pt", activationUrl: "https://flashpilot.net/activate?token=exemplo&actionId=exemplo" },
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
