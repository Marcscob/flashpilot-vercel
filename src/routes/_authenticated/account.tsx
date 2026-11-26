import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { accountOverview } from "@/lib/account.functions";
import { ensureSubjectDelivery } from "@/lib/official-content.functions";
import { Button } from "@/components/ui/button";
import { Coins, CreditCard, Loader2, Package, Receipt, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useT, useLang, useOverlayD } from "@/lib/i18n";
import { usePanelT } from "@/lib/i18n-panel";
import { MyDetailsCard } from "@/components/MyDetailsCard";
import { DeleteAccountCard } from "@/components/DeleteAccountCard";
import { ledgerCopy, ledgerKind } from "@/lib/ledger-labels";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Minha conta — Flash Pilot" },
      { name: "description", content: "Assinatura, saldo de FlashCoins, histórico de consumo e pacotes liberados." },
      { property: "og:title", content: "Minha conta — Flash Pilot" },
      { property: "og:description", content: "Assinatura, FlashCoins e pacotes liberados no Flash Pilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const t = useT().account;
  const tp = useT().pricing;
  const p = usePanelT();
  const { lang, extLang } = useLang();
  const overlay = useOverlayD();
  // Padrão do país do usuário: localidade completa do navegador (pt-BR, en-GB, ja-JP…),
  // caindo no idioma da interface quando indisponível.
  const fallbackLocale = extLang ?? (lang === "pt" ? "pt-BR" : lang);
  const locTag = (() => {
    try {
      return Intl.getCanonicalLocales(typeof navigator !== "undefined" ? navigator.language : fallbackLocale)[0] ?? fallbackLocale;
    } catch { return fallbackLocale; }
  })();
  const num = (n: number) => n.toLocaleString(locTag);
  const date = (v: string | number | Date) => new Date(v).toLocaleDateString(locTag);
  const money = (cents: number | null | undefined, currency = "usd") =>
    cents == null ? "—" : (cents / 100).toLocaleString(locTag, { style: "currency", currency: currency.toUpperCase() });
  const lc = ledgerCopy(extLang ?? lang, overlay ?? undefined);
  const actionLabel = (k: string) => (k === "flashcards" ? lc.flashcardsUsage : t.actions[k] ?? k);
  const fn = useServerFn(accountOverview);
  const q = useQuery({ queryKey: ["account-overview"], queryFn: () => fn({}), staleTime: 0, refetchOnMount: "always" });
  const data = q.data;
  // Rótulo do plano ativo: Pro 2 (mensal/anual) reconhecido pelo price_id ou product_id.
  const planLabel = (() => {
    const s = data?.subscription as { price_id?: string | null; product_id?: string | null } | undefined;
    if (!s) return "";
    if (s.price_id === "pro_2_yearly") return tp.yearly2;
    if (s.price_id === "pro_2_monthly") return tp.monthly2;
    if (s.product_id === "pro_2") return tp.plan2;
    if (s.price_id === "pro_yearly") return tp.yearly;
    if (s.price_id === "pro_monthly") return tp.monthly;
    return s.product_id ?? "";
  })();
  const isPro2Plan = (() => {
    const s = data?.subscription as { price_id?: string | null; product_id?: string | null } | undefined;
    return !!s && ((s.price_id ?? "").startsWith("pro_2") || s.product_id === "pro_2");
  })();

  // Entrega automática: matéria paga que ainda não tem cópia na conta do aluno.
  const deliver = useServerFn(ensureSubjectDelivery);
  const delivering = useRef(new Set<string>());
  useEffect(() => {
    const pending = (data?.purchases ?? []).filter((row) => row.active && !row.copySubjectId);
    for (const row of pending) {
      if (delivering.current.has(row.product_id)) continue;
      delivering.current.add(row.product_id);
      deliver({ data: { productId: row.product_id } })
        .then(() => q.refetch())
        .catch(() => {});
    }
  }, [data]);

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-serif text-foreground">
          <UserRound className="h-6 w-6 text-primary" /> {t.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.subtitle}
        </p>

        <MyDetailsCard />


        {q.isLoading && (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
          </div>
        )}
        {q.isError && <p className="mt-10 text-sm text-muted-foreground">{t.error}</p>}

        {data && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="flex items-center gap-2 font-serif text-foreground">
                  <CreditCard className="h-5 w-5 text-primary" /> {t.subscription}
                </h2>
                {data.isOwner ? (
                  <>
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" /> {t.ownerBadge}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t.ownerDesc}
                    </p>
                  </>
                ) : data.subscriptionActive && data.subscription ? (
                  <>
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      <ShieldCheck className="h-3.5 w-3.5" /> {t.active}
                    </p>
                    <p className="mt-3 text-sm text-foreground">
                      {t.plan}{" "}
                      <span className="font-medium">
                        {planLabel}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {tp.aiCycleCards(num(isPro2Plan ? 2200 : 700))}
                    </p>
                    {data.subscription.current_period_end && (
                      <p className="text-sm text-muted-foreground">
                        {data.subscription.cancel_at_period_end ? t.accessUntil : t.renewsOn}
                        {date(data.subscription.current_period_end)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t.freePlan}
                    </p>
                    <Button asChild className="mt-4 w-full">
                      <Link to="/pricing">{t.seePlans}</Link>
                    </Button>
                  </>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="flex items-center gap-2 font-serif text-foreground">
                  <Coins className="h-5 w-5 text-primary" /> FlashCoins
                </h2>
                <p className="mt-3 text-3xl font-semibold text-foreground">
                  {num(data.balance)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{t.coinsFree}</span>
                </p>
                <p className="text-xs text-muted-foreground">{t.coinsAvailable}</p>
                <Button asChild variant="secondary" className="mt-4 w-full">
                  <Link to="/store">{t.buyCoins}</Link>
                </Button>
              </section>
            </div>

            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-serif text-foreground">
                <Sparkles className="h-5 w-5 text-primary" /> {t.usage30d}
              </h2>
              {data.usage30d.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t.noUsage}</p>
              ) : (
                <ul className="mt-3 divide-y divide-border text-sm">
                  {data.usage30d.map((u) => (
                    <li key={u.kind} className="flex items-center justify-between py-2">
                      <span className="text-foreground">{actionLabel(u.kind)}</span>
                      <span className="text-muted-foreground">
                        {u.kind === "flashcards" ? t.cardsCoins(num(u.count), num(u.coins)) : t.usesCoins(num(u.count), num(u.coins))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-serif text-foreground">
                <Package className="h-5 w-5 text-primary" /> {p.subjectsTitle}
              </h2>
              {data.purchases.length === 0 ? (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">{p.subjectsEmpty}</p>
                  <Button asChild variant="secondary" className="mt-3">
                    <Link to="/store">{p.browseStore}</Link>
                  </Button>
                </div>
              ) : (
                <ul className="mt-3 max-h-96 overflow-y-auto divide-y divide-border text-sm pr-1">
                  {data.purchases.map((row) => (
                    <li key={row.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{row.productName}</span>
                        <span
                          className={
                            "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                            (row.status === "active"
                              ? "bg-primary/10 text-primary"
                              : row.status === "ending"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground")
                          }
                        >
                          {row.status === "active"
                            ? p.statusActive
                            : row.status === "ending"
                              ? p.statusEnding
                              : row.status === "refunded"
                                ? p.statusRefunded
                                : p.statusExpired}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{p.purchasedOn} {date(row.purchased_at)}</span>
                        {row.amount_cents != null && (
                          <span>{p.paid} {money(row.amount_cents, row.currency ?? "usd")}</span>
                        )}
                        <span>{p.expiresOn} {date(row.expires_at)}</span>
                        {row.status !== "refunded" && row.active && <span>{p.daysLeft(num(row.daysLeft))}</span>}
                        {row.environment !== "live" && row.environment !== "owner" && <span>({p.testEnv})</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {row.active && row.copySubjectId && (
                          <Button asChild size="sm" variant="secondary">
                            <Link to="/subjects/$subjectId" params={{ subjectId: row.copySubjectId }}>
                              {p.study}
                            </Link>
                          </Button>
                        )}
                        {!row.active && (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/store">{p.renew}</Link>
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-serif text-foreground">
                <Receipt className="h-5 w-5 text-primary" /> {p.paymentsTitle}
              </h2>
              {data.payments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{p.paymentsEmpty}</p>
              ) : (
                <ul className="mt-3 divide-y divide-border text-sm">
                  {data.payments.map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="text-foreground">
                        {row.label}
                        {row.environment !== "live" && (
                          <span className="ml-2 text-xs text-muted-foreground">({p.testEnv})</span>
                        )}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-foreground">{money(row.amount_cents, row.currency ?? "usd")}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.created_at ? date(row.created_at) : "—"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="font-serif text-foreground">{p.coinsHistory}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{lc.statementHint}</p>
              {data.ledger.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t.noLedger}</p>
              ) : (
                <ul className="mt-3 divide-y divide-border text-sm">
                  {data.ledger.map((l) => {
                    const info = lc[ledgerKind(l.reason, l.action_id)];
                    return (
                      <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                        <span className="min-w-0">
                          <span className="block font-medium text-foreground">{info.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {info.detail} · {new Date(l.created_at).toLocaleString(locTag, { dateStyle: "short", timeStyle: "short" })}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className={"block font-semibold " + (l.amount >= 0 ? "text-primary" : "text-foreground")}>
                            {l.amount >= 0 ? "+" : ""}{num(l.amount)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {lc.balanceAfter}: {num(l.balance_after)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <p className="mt-8 text-xs text-muted-foreground">
              {t.accountLabel} {data.email}
              {data.memberSince && ` · ${t.since} ${date(data.memberSince)}`}
            </p>
          </>
        )}
        <DeleteAccountCard />
      </div>
    </div>
  );
}
