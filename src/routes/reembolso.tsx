import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { CONTACT_EMAIL, CONTACT_WHATSAPP_DISPLAY } from "@/lib/plan-limit";
import { LegalLayout } from "@/components/LegalLayout";
import { useLang, useOverlayD, useT } from "@/lib/i18n";
import { refundCopy } from "@/lib/refund-copy";

export const Route = createFileRoute("/reembolso")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://flashpilot.net/reembolso" }],
    meta: [
      { property: "og:url", content: "https://flashpilot.net/reembolso" },
      { title: "Política de Reembolso | FlashPilot" },
      { name: "description", content: "Garantia de 15 dias do FlashPilot: reembolso integral em até 15 dias após a compra, sem perguntas complicadas." },
      { property: "og:title", content: "Política de Reembolso | FlashPilot" },
      { property: "og:description", content: "Garantia de 15 dias do FlashPilot: reembolso integral em até 15 dias após a compra." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  const { lang, extLang } = useLang();
  const t = useT();
  const overlay = useOverlayD();
  const c = refundCopy(extLang ?? lang, overlay ?? undefined);
  useEffect(() => {
    document.title = `${c.policyTitle} | FlashPilot`;
  }, [c.policyTitle]);
  const fill = (s: string) => s.replace("{email}", CONTACT_EMAIL).replace("{whatsapp}", CONTACT_WHATSAPP_DISPLAY);
  return (
    <LegalLayout
      icon={<ShieldCheck className="h-5 w-5" />}
      title={c.policyTitle}
      updatedAt={t.legal.updatedAt}
      footer={
        <p className="flex gap-4">
          <Link to="/termos" className="underline">{t.shell.terms}</Link>
          <Link to="/privacidade" className="underline">{t.shell.privacy}</Link>
        </p>
      }
    >
      <h2>{c.title}</h2>
      <p><strong>{c.lead}</strong> {c.body} {c.note}</p>
      {c.sections.map((s) => (
        <div key={s.h}>
          <h2>{s.h}</h2>
          <p>{fill(s.p)}</p>
        </div>
      ))}
    </LegalLayout>
  );
}
