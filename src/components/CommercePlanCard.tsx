import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang, useT } from "@/lib/i18n";
import type { CommercePlan } from "@/lib/commerce-plans";

export function CommercePlanCard({ plan, active, disabled, pending, onClick }: {
  plan: CommercePlan;
  active: boolean;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const t = useT().pricing;
  const { lang, extLang } = useLang();
  const locale = extLang || (lang === "pt" ? "pt-BR" : lang);
  const number = (value: number) => value.toLocaleString(locale);
  const amount = (plan.amount / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const features = [
    t.monthlyCards(number(plan.cards)),
    t.batchCards(number(plan.batch)),
    plan.annual ? t.yearlyCoins(number(plan.coins)) : t.monthlyCoins(number(plan.coins)),
    t.fUnlimited, t.fSpaced, t.fDictation, t.fSupport,
    ...(plan.annual ? [t.fOneCharge] : []),
  ];
  return (
    <article className={`flex min-w-0 flex-col rounded-lg border bg-card p-5 ${active ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-serif text-foreground">{t[plan.label]}</h3>
        {(active || plan.annual) && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{active ? t.current : t.save33}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-1">
        <span className="text-3xl font-semibold text-foreground">US$ {amount}</span>
        <span className="text-sm text-muted-foreground">{plan.annual ? t.perYear : t.perMonth}</span>
      </div>
      <ul className="my-5 space-y-2 text-sm text-muted-foreground">
        {features.map((feature) => <li key={feature} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{feature}</span></li>)}
      </ul>
      <Button className="mt-auto w-full" disabled={disabled} onClick={onClick}>
        {pending && !active ? <Loader2 className="h-4 w-4 animate-spin" /> : active ? t.current : plan.annual ? t.subYearly : t.subMonthly}
      </Button>
    </article>
  );
}