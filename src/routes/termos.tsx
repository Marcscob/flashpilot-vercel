import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { useEffect } from "react";
import { CONTACT_EMAIL, CONTACT_WHATSAPP_DISPLAY } from "@/lib/plan-limit";
import { LegalLayout } from "@/components/LegalLayout";
import { LegalSections } from "@/components/LegalSections";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/termos")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://flashpilot.net/termos" }],
    meta: [
      { property: "og:url", content: "https://flashpilot.net/termos" },
      { title: "Termos de Uso | FlashPilot" },
      { name: "description", content: "Regras de uso do FlashPilot: conta, assinatura, FlashCoins, conteúdo, pagamentos e cancelamento." },
      { property: "og:title", content: "Termos de Uso | FlashPilot" },
      { property: "og:description", content: "Regras de uso do FlashPilot: conta, assinatura, FlashCoins, conteúdo, pagamentos e cancelamento." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const t = useT();
  const sections = t.legal.terms.sections({ email: CONTACT_EMAIL, whatsapp: CONTACT_WHATSAPP_DISPLAY });

  useEffect(() => {
    document.title = t.legal.terms.metaTitle;
  }, [t]);

  return (
    <LegalLayout
      icon={<FileText className="h-5 w-5" />}
      title={t.legal.terms.title}
      updatedAt={t.legal.updatedAt}
      footer={
        <p>
          <Link to="/privacidade" className="underline">
            {t.legal.terms.seeAlso}
          </Link>
        </p>
      }
    >
      <LegalSections sections={sections} />
    </LegalLayout>
  );
}
