import { Lock, ShieldCheck, CreditCard } from "lucide-react";
import { useT } from "@/lib/i18n";

export function TrustBadges({ className = "" }: { className?: string }) {
  const t = useT();
  const items = [
    { icon: Lock, label: t.trust.secureConnection },
    { icon: CreditCard, label: t.trust.securePurchase },
    { icon: ShieldCheck, label: t.trust.dataProtected },
  ];

  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 ${className}`}>
      {items.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
          {label}
        </span>
      ))}
    </div>
  );
}
