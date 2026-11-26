import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_URL = "https://flashpilot.net";
const CONTACT_EMAIL = "contact@flashpilot.net";

interface BlogCommentNotificationProps {
  postTitle: string;
  postUrl: string;
  authorName: string;
  authorEmail?: string | null;
  comment: string;
  createdAt?: string;
}

export function BlogCommentNotificationEmail({
  postTitle,
  postUrl,
  authorName,
  authorEmail,
  comment,
  createdAt,
}: BlogCommentNotificationProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`Novo comentário de ${authorName} em "${postTitle}"`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={card}>
            <Heading style={h1}>Novo comentário no blog</Heading>
            <Text style={meta}>
              <strong>Artigo:</strong> {postTitle}
            </Text>
            <Text style={meta}>
              <strong>Autor:</strong> {authorName}
              {authorEmail ? ` (${authorEmail})` : ""}
            </Text>
            {createdAt ? (
              <Text style={meta}>
                <strong>Data:</strong> {createdAt}
              </Text>
            ) : null}
            <Text style={quote}>{comment}</Text>
            <Button style={button} href={postUrl}>
              Ver artigo
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const template = {
  component: BlogCommentNotificationEmail,
  subject: (data: Record<string, unknown>) =>
    `Novo comentário no blog: ${String(data["postTitle"] ?? "").replace(/[\r\n]+/g, " ")}`.slice(
      0,
      200,
    ),
  displayName: "Comentário no blog (cópia interna)",
  to: CONTACT_EMAIL,
  previewData: {
    postTitle: "Como estudar com revisão espaçada",
    postUrl: `${SITE_URL}/pt/blog/como-estudar-com-revisao-espacada`,
    authorName: "Maria",
    authorEmail: "maria@example.com",
    comment: "Adorei o artigo!",
    createdAt: "05/11/2026 12:00",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px 16px", maxWidth: "600px" };
const card = {
  backgroundColor: "#faf6ee",
  border: "1px solid #e7ded0",
  borderRadius: "14px",
  padding: "24px",
};
const h1 = { fontSize: "20px", color: "#1d2233", margin: "0 0 16px" };
const meta = { fontSize: "14px", color: "#4a4f60", margin: "0 0 6px", lineHeight: "1.5" };
const quote = {
  fontSize: "15px",
  color: "#1d2233",
  lineHeight: "1.6",
  whiteSpace: "pre-wrap" as const,
  backgroundColor: "#ffffff",
  border: "1px solid #e7ded0",
  borderRadius: "10px",
  padding: "14px",
  margin: "14px 0 18px",
};
const button = {
  backgroundColor: "#e2680f",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  borderRadius: "10px",
  padding: "11px 22px",
  textDecoration: "none",
  display: "inline-block",
};
