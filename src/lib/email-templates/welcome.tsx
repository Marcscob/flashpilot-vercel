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
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { welcomeCopy, resolveWelcomeLang, type EmailLang } from "./signup-i18n";
import { welcomeDirection } from "../welcome-locale";
import { TrialKitBlock } from "./trial-kit-block";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "FlashPilot";
const SITE_URL = "https://flashpilot.net";

interface WelcomeEmailProps {
  siteName?: string;
  siteUrl?: string;
  lang?: EmailLang | string;
  trialEndsAt?: string | null;
}

export const WelcomeEmail = ({
  siteName = SITE_NAME,
  siteUrl = SITE_URL,
  lang = "pt",
  trialEndsAt,
}: WelcomeEmailProps) => {
  const locale = resolveWelcomeLang(String(lang));
  const c = welcomeCopy(locale, siteName);
  return (
    <Html lang={c.htmlLang} dir={welcomeDirection(locale)}>
      <Head />
      <Preview>{c.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoWrap}>
            <Img src={`${siteUrl}/flashpilot-logo.png`} alt={siteName} width="280" style={logo} />
          </Section>

          <Section style={card}>
            <Heading style={h1}>{c.title}</Heading>
            <Text style={text}>{c.intro}</Text>
            <Section style={buttonWrap}>
              <Button className="dm-btn" style={button} href={`${siteUrl}/home`}>
                {c.cta}
              </Button>
            </Section>

            <Hr style={hr} />

            <TrialKitBlock
              lang={locale}
              trialEndsAt={trialEndsAt}
              showEligibilityNote={false}
            />

          </Section>

          <Section style={footerWrap}>
            <Text style={footer}>
              <Link href={`${siteUrl}/termos`} style={footerLink}>
                {c.terms}
              </Link>
              {"  ·  "}
              <Link href={`${siteUrl}/privacidade`} style={footerLink}>
                {c.privacy}
              </Link>
              {"  ·  "}
              <Link href={siteUrl} style={footerLink}>
                {siteName}
              </Link>
            </Text>
            {c.note && <Text style={footer}>{c.note}</Text>}
            {c.tagline && <Text style={footerMuted}>
              {siteName} — {c.tagline}
            </Text>}
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

export const template = {
  component: WelcomeEmail,
  subject: (data: Record<string, unknown>) =>
    welcomeCopy(resolveWelcomeLang(String(data["lang"] ?? "en")), String(data["siteName"] ?? SITE_NAME))
      .subject,
  displayName: "Boas-vindas (cadastro social)",
  previewData: { siteName: SITE_NAME, siteUrl: SITE_URL, lang: "pt" },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, Helvetica, sans-serif",
};
const container = { padding: "24px 16px", maxWidth: "600px" };
const logoWrap = { textAlign: "center" as const, padding: "0 0 16px" };
const logo = { margin: "0 auto", display: "block" };
const card = {
  backgroundColor: "#faf6ee",
  border: "1px solid #e7ded0",
  borderRadius: "14px",
  padding: "28px 26px",
};
const h1 = {
  fontSize: "23px",
  fontWeight: "bold" as const,
  color: "#1d2233",
  margin: "0 0 16px",
  lineHeight: "1.3",
};
const text = {
  fontSize: "14px",
  color: "#4a4f60",
  lineHeight: "1.6",
  margin: "0 0 18px",
};
const kicker = {
  fontSize: "11px",
  letterSpacing: "1px",
  fontWeight: "bold" as const,
  color: "#c05621",
  margin: "0 0 10px",
};
const buttonWrap = { textAlign: "center" as const, padding: "4px 0 8px" };
const button = {
  backgroundColor: "#1d2233",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "bold" as const,
  border: "1px solid #1d2233",
  borderRadius: "10px",
  padding: "13px 26px",
  textDecoration: "none",
  display: "inline-block",
};
const secondaryButton = {
  backgroundColor: "#e2680f",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  border: "1px solid #e2680f",
  borderRadius: "10px",
  padding: "12px 24px",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#e7ded0", margin: "24px 0" };
const perkRow = {
  backgroundColor: "#ffffff",
  border: "1px solid #ece4d7",
  borderLeft: "4px solid #e2680f",
  borderRadius: "10px",
  padding: "12px 14px",
  margin: "0 0 10px",
};
const perkTitle = {
  fontSize: "14px",
  fontWeight: "bold" as const,
  color: "#1d2233",
  margin: "0 0 4px",
};
const perkDesc = {
  fontSize: "13px",
  color: "#6a7080",
  lineHeight: "1.5",
  margin: "0",
};
const footerWrap = { padding: "22px 8px 0", textAlign: "center" as const };
const footer = {
  fontSize: "12px",
  color: "#8b8f9c",
  lineHeight: "1.6",
  margin: "0 0 8px",
};
const footerLink = { color: "#8b8f9c", textDecoration: "underline" };
const footerMuted = { fontSize: "11px", color: "#b0b4bf", margin: "10px 0 0" };
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #ffffff !important; color: #1d2233 !important; }
  }
  [data-ogsc] .dm-btn { background-color: #ffffff !important; color: #1d2233 !important; }
  [data-ogsb] .dm-btn { background-color: #ffffff !important; color: #1d2233 !important; }
`;
