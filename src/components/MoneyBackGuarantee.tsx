import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useLang, useOverlayD } from "@/lib/i18n";
import { refundCopy } from "@/lib/refund-copy";

export function MoneyBackGuarantee({ className = "" }: { className?: string }) {
  const { lang, extLang } = useLang();
  const overlay = useOverlayD();
  const c = refundCopy(extLang ?? lang, overlay ?? undefined);
  return (
    <div
      className={`flex gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5 text-left ${className}`}
    >
      <ShieldCheck className="h-8 w-8 shrink-0 text-primary" aria-hidden />
      <div className="space-y-1 text-sm">
        <p className="text-base font-semibold text-foreground">{c.title}</p>
        <p className="font-medium text-foreground">{c.lead}</p>
        <p className="text-muted-foreground">{c.body}</p>
        <p className="text-muted-foreground">{c.note}</p>
        <Link to="/reembolso" className="inline-block pt-1 text-primary underline">
          {c.link}
        </Link>
      </div>
    </div>
  );
}

export function RefundLink({ className }: { className?: string }) {
  const { lang, extLang } = useLang();
  const overlay = useOverlayD();
  return (
    <Link to="/reembolso" className={className}>
      {refundCopy(extLang ?? lang, overlay ?? undefined).link}
    </Link>
  );
}
