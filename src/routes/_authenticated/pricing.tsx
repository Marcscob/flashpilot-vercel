import { MoneyBackGuarantee } from "@/components/MoneyBackGuarantee";
import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { CheckoutConfirmingNotice } from "@/components/CheckoutConfirmingNotice";
import { useCheckoutConfirmation } from "@/hooks/useCheckoutConfirmation";
import { CheckoutPendingNotice } from "@/components/CheckoutPendingNotice";
import { aiCreditStatus } from "@/lib/ai-credits.functions";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";
import { CommercePlanCard } from "@/components/CommercePlanCard";
import { COMMERCE_PLANS, isCurrentCommercePlan, subscriptionPlanTier, type CommercePriceId } from "@/lib/commerce-plans";

export const Route = createFileRoute("/_authenticated/pricing")({
  head: () => pageHead("Planos Pro e Pro 2 — FlashPilot", "Compare preços, cotas do PilotAI e FlashCoins dos planos Pro e Pro 2 do FlashPilot."),
  component: PricingPage,
});

function PricingPage() {
  const t = useT().pricing;
  const { openCheckout, loading, checkoutBlocked } = usePaddleCheckout();
  const confirm = useCheckoutConfirmation();
  const { subscription, isActive } = useSubscription();

  const me = useQuery({
    queryKey: ["me-for-checkout"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const buy = (priceId: CommercePriceId) => {
    const user = me.data;
    if (!user) return;
    openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      customData: { userId: user.id },
      successUrl: `${window.location.origin}/home?checkout=success`,
    });
  };

  const activeTier = subscriptionPlanTier(subscription);

  return (
    <>
      <PaymentTestModeBanner />
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <CheckoutPendingNotice show={checkoutBlocked} />
        <CheckoutConfirmingNotice show={confirm.waiting} label={confirm.waitingLabel} />
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-serif text-foreground">{t.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isActive ? t.switchBlocked : t.subtitle}
            </p>
            {isActive && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" /> {activeTier === "pro2" ? t.pro2Active : t.proActive}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {COMMERCE_PLANS.map((plan) => (
              <CommercePlanCard key={plan.priceId} plan={plan}
                active={isCurrentCommercePlan(plan, subscription, isActive)}
                disabled={loading || isActive} pending={loading}
                onClick={() => buy(plan.priceId)} />
            ))}
          </div>

          <MoneyBackGuarantee className="mt-6" />

          <div className="mt-10 rounded-2xl border border-border bg-card p-6 text-center">
            <h2 className="text-xl font-serif text-foreground">{t.singleTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.singleDesc}
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/store">{t.seeStore}</Link>
            </Button>
          </div>


          <CreditsPanel />

          <div className="mt-8 text-center">
            <Link to="/home" className="text-sm text-muted-foreground underline">{t.back}</Link>
          </div>
        </div>
      </div>
    </>
  );
}

/** Painel de créditos do PilotAI: saldo do mês e consumo da voz em nuvem. */
function CreditsPanel() {
  const t = useT().pricing;
  const { lang } = useLang();
  const credits = useQuery({
    queryKey: ["ai-credits"],
    queryFn: () => aiCreditStatus(),
    staleTime: 30_000,
  });

  const c = credits.data;
  const pct = c && c.limit > 0 ? Math.min(100, Math.round((c.used / c.limit) * 100)) : 0;
  const fmt = (n: number) => n.toLocaleString(lang);
  const renew = c ? new Date(c.periodEnd).toLocaleDateString(lang) : "";

  return (
    <div className="mt-10">
      <h2 className="text-xl font-serif text-foreground mb-3">{t.creditsTitle}</h2>
      <div className="rounded-2xl border border-border bg-card p-6">
        {credits.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.creditsLoading}
          </div>
        )}
        {credits.isError && (
          <p className="text-sm text-muted-foreground">{t.creditsError}</p>
        )}
        {c && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.remainingLabel}</p>
                <p className="text-3xl font-semibold text-foreground">
                  {fmt(c.remaining)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {t.ofChars(fmt(c.limit))}
                  </span>
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{t.cloudUse} <strong className="text-foreground">{fmt(c.used)}</strong> {t.chars}</p>
                <p>{c.cloudGenerations} {t.narrations(c.cloudGenerations)}</p>
              </div>
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {c.chat && (
              <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.chatTitle}</p>
                <p className="mt-1 text-foreground">
                  {t.chatUsed(fmt(c.chat.used), fmt(c.chat.limit), c.chat.minutesRemaining)}
                </p>
              </div>
            )}

            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <li>{t.resetsOn(renew)}</li>
              <li>{t.catalogFree}</li>
              <li>{t.deviceVoiceFree}</li>
              {!c.hasSubscription && (
                <li className="text-foreground">
                  {t.proOnly}
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

