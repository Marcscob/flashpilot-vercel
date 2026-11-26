import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { blogNewsletterEmailCopy } from "./blog-newsletter-i18n";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "FlashPilot";
const SITE_URL = "https://flashpilot.net";

interface BlogNewPostEmailProps {
  lang?: string;
  title: string;
  excerpt?: string | null;
  postUrl: string;
  unsubscribeUrl: string;
}

export function BlogNewPostEmail({
  lang = "en",
  title,
  excerpt,
  postUrl,
  unsubscribeUrl,
}: BlogNewPostEmailProps) {
  const { lang: emailLang, dir, copy } = blogNewsletterEmailCopy(lang);
  return (
    <Html lang={emailLang} dir={dir}>
      <Head />
      <Preview>{copy.postPreview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoWrap}>
            <Img src={`${SITE_URL}/flashpilot-logo.png`} alt={SITE_NAME} width="280" style={logo} />
          </Section>
          <Section style={card}>
            <Heading style={h1}>{copy.greeting}</Heading>
            <Text style={text}>{copy.postIntro}</Text>
            <Heading as="h2" style={h2}>
              {title}
            </Heading>
            {excerpt ? <Text style={text}>{excerpt}</Text> : null}
            <Section style={buttonWrap}>
              <Button style={button} href={postUrl}>
                {copy.readButton}
              </Button>
            </Section>
          </Section>
          <Section style={footer}>
            <Text style={footerText}>{copy.postFooter}</Text>
            <Text style={footerText}>
              <Link href={unsubscribeUrl} style={footerLink}>
                {copy.unsubscribe}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: BlogNewPostEmail,
  subject: (data: Record<string, unknown>) => {
    const copy = blogNewsletterEmailCopy(String(data["lang"] ?? "en")).copy;
    const title = String(data["title"] ?? "");
    return copy.postSubject.replace(/\{title\}/g, () => title);
  },
  displayName: "Novo artigo do blog",
  previewData: {
    lang: "pt",
    title: "Como estudar com revisão espaçada",
    excerpt: "Uma introdução prática para organizar os estudos e revisar no momento certo.",
    postUrl: `${SITE_URL}/pt/blog/como-estudar-com-revisao-espacada`,
    unsubscribeUrl: `${SITE_URL}/blog/unsubscribe?token=preview`,
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
  fontSize: "18px",
  fontWeight: "normal" as const,
  color: "#4a4f60",
  margin: "0 0 12px",
};
const h2 = {
  fontSize: "23px",
  fontWeight: "bold" as const,
  color: "#1d2233",
  margin: "0 0 16px",
  lineHeight: "1.3",
};
const text = { fontSize: "14px", color: "#4a4f60", lineHeight: "1.6", margin: "0 0 18px" };
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
const footer = { padding: "18px 8px 0" };
const footerText = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "1.6",
  textAlign: "center" as const,
  margin: "0 0 8px",
};
const footerLink = { color: "#9a4f0a", textDecoration: "underline" };
