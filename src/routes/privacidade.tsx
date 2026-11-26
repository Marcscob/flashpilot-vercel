import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { CONTACT_EMAIL, CONTACT_WHATSAPP_DISPLAY } from "@/lib/plan-limit";
import { LegalLayout } from "@/components/LegalLayout";
import { LegalSections } from "@/components/LegalSections";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://flashpilot.net/privacidade" }],
    meta: [
      { property: "og:url", content: "https://flashpilot.net/privacidade" },
      { title: "Política de Privacidade | FlashPilot" },
      { name: "description", content: "Como o FlashPilot coleta, usa, armazena e protege seus dados pessoais, conforme a LGPD." },
      { property: "og:title", content: "Política de Privacidade | FlashPilot" },
      { property: "og:description", content: "Como o FlashPilot coleta, usa, armazena e protege seus dados pessoais, conforme a LGPD." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const t = useT();
  const sections = t.legal.privacy.sections({ email: CONTACT_EMAIL, whatsapp: CONTACT_WHATSAPP_DISPLAY });

  useEffect(() => {
    document.title = t.legal.privacy.metaTitle;
  }, [t]);

  return (
    <LegalLayout
      icon={<ShieldCheck className="h-5 w-5" />}
      title={t.legal.privacy.title}
      updatedAt={t.legal.updatedAt}
      footer={
        <p>
          <Link to="/termos" className="underline">
            {t.legal.privacy.seeAlso}
          </Link>
        </p>
      }
    >
      <LegalSections sections={sections} />
    </LegalLayout>
  );
}
