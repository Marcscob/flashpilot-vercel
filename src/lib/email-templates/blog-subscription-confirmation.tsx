import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { blogNewsletterEmailCopy } from "./blog-newsletter-i18n";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "FlashPilot";
const SITE_URL = "https://flashpilot.net";

interface BlogSubscriptionConfirmationProps {
  lang?: string;
  confirmationUrl: string;
}

export function BlogSubscriptionConfirmationEmail({
  lang = "en",
  confirmationUrl,
}: BlogSubscriptionConfirmationProps) {
  const { lang: emailLang, dir, copy } = blogNewsletterEmailCopy(lang);
  return (
    <Html lang={emailLang} dir={dir}>
      <Head />
      <Preview>{copy.confirmationPreview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoWrap}>
            <Img src={`${SITE_URL}/flashpilot-logo.png`} alt={SITE_NAME} width="280" style={logo} />
          </Section>
          <Section style={card}>
            <Heading style={h1}>{copy.confirmationTitle}</Heading>
            <Text style={text}>{copy.confirmationBody}</Text>
            <Section style={buttonWrap}>
              <Button style={button} href={confirmationUrl}>
                {copy.confirmationButton}
              </Button>
            </Section>
            <Text style={muted}>{copy.confirmationIgnore}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: BlogSubscriptionConfirmationEmail,
  subject: (data: Record<string, unknown>) =>
    blogNewsletterEmailCopy(String(data["lang"] ?? "en")).copy.confirmationSubject,
  displayName: "Confirmação da newsletter do blog",
  previewData: {
    lang: "pt",
    confirmationUrl: `${SITE_URL}/blog/confirm-subscription?token=preview`,
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
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
const text = { fontSize: "14px", color: "#4a4f60", lineHeight: "1.6", margin: "0 0 18px" };
const muted = { ...text, color: "#6b7280", fontSize: "12px", margin: "20px 0 0" };
const buttonWrap = { textAlign: "center" as const, padding: "4px 0 8px" };
const button = {
  backgroundColor: "#e2680f",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "bold" as const,
  border: "1px solid #e2680f",
  borderRadius: "10px",
  padding: "13px 26px",
  textDecoration: "none",
  display: "inline-block",
};
