import * as React from "react";
import { Section, Text } from "@react-email/components";
import { trialKitCopy, trialEndLabel } from "./trial-kit-i18n";

export function TrialKitBlock({
  lang,
  trialEndsAt,
  showEligibilityNote = true,
}: {
  lang: string;
  trialEndsAt?: string | null;
  showEligibilityNote?: boolean;
}) {
  const t = trialKitCopy(lang);
  const date = trialEndLabel(lang, trialEndsAt);

  return (
    <>
      <Section style={banner}>
        <Text style={badge}>✦ {t.badge}</Text>
        <Text style={headline}>{t.headline}</Text>
        {date && <Text style={ends}>{t.endsOn.replace("{date}", date)}</Text>}
      </Section>

      {showEligibilityNote && <Text style={eligibility}>{t.eligibilityNote}</Text>}

      <Text style={listTitle}>{t.listTitle}</Text>
      {t.perks.map((p) => (
        <Section key={p.title} style={row}>
          <Text style={rowTitle}>✓ {p.title}</Text>
          <Text style={rowDesc}>{p.desc}</Text>
        </Section>
      ))}

      <Section style={safe}>
        <Text style={safeTitle}>{t.safeTitle}</Text>
        <Text style={safeText}>{t.safeText}</Text>
      </Section>
    </>
  );
}

const banner = {
  backgroundColor: "#1d2233",
  borderRadius: "12px",
  padding: "18px 20px",
  margin: "0 0 22px",
  textAlign: "center" as const,
};
const badge = {
  fontSize: "11px",
  letterSpacing: "1.5px",
  fontWeight: "bold" as const,
  color: "#f5a65b",
  margin: "0 0 6px",
};
const headline = {
  fontSize: "19px",
  fontWeight: "bold" as const,
  color: "#ffffff",
  margin: "0 0 6px",
  lineHeight: "1.3",
};
const ends = { fontSize: "14px", color: "#e7ded0", margin: "0" };
const eligibility = {
  fontSize: "12px",
  color: "#6a7080",
  margin: "-14px 0 18px",
  lineHeight: "1.5",
};
const listTitle = {
  fontSize: "15px",
  fontWeight: "bold" as const,
  color: "#1d2233",
  margin: "0 0 10px",
};
const row = { borderLeft: "3px solid #e2680f", padding: "2px 0 2px 12px", margin: "0 0 12px" };
const rowTitle = { fontSize: "14px", fontWeight: "bold" as const, color: "#1d2233", margin: "0" };
const rowDesc = { fontSize: "13px", color: "#4a4f60", margin: "2px 0 0", lineHeight: "1.5" };
const safe = {
  backgroundColor: "#ffffff",
  border: "1px solid #e7ded0",
  borderRadius: "10px",
  padding: "14px 16px",
  margin: "8px 0 4px",
};
const safeTitle = {
  fontSize: "14px",
  fontWeight: "bold" as const,
  color: "#1d2233",
  margin: "0 0 4px",
};
const safeText = { fontSize: "13px", color: "#4a4f60", margin: "0", lineHeight: "1.5" };
