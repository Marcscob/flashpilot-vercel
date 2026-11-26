import { MoneyBackGuarantee } from "@/components/MoneyBackGuarantee";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { storeCatalog, claimOwnerPack, packBuyers, createSubjectCheckout } from "@/lib/store.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { ensureSubjectDelivery, mySubjectGrants, setRenewMode } from "@/lib/official-content.functions";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { useAiBillingInfo } from "@/hooks/useAiBillingInfo";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { CheckoutConfirmingNotice } from "@/components/CheckoutConfirmingNotice";
import { useCheckoutConfirmation } from "@/hooks/useCheckoutConfirmation";
import { CheckoutPendingNotice } from "@/components/CheckoutPendingNotice";
import { PaddleTrustPopover } from "@/components/PaddleTrustPopover";
import { CommercePlanCard } from "@/components/CommercePlanCard";
import { CommerceItemInfo } from "@/components/CommerceItemInfo";
import { COMMERCE_PLANS, isCurrentCommercePlan, subscriptionPlanTier, type CommercePriceId } from "@/lib/commerce-plans";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Coins, Download, Loader2, Lock, Package, RefreshCw, ShieldCheck, ShoppingBag, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { useT, useLang, useOverlayD } from "@/lib/i18n";
import { FlagIcon } from "@/components/FlagIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { defaultCountryForLang, findCountry, sortedCountries } from "@/lib/countries";

export const Route = createFileRoute("/_authenticated/store")({
  head: () => ({
    meta: [
      { title: "Loja — Flash Pilot" },
      { name: "description", content: "Assine o FlashPilot Pro ou Pro 2 ou compre FlashCoins e pacotes de matérias com pagamento seguro." },
      { property: "og:title", content: "Loja — Flash Pilot" },
      { property: "og:description", content: "Planos Pro e Pro 2, FlashCoins e pacotes de matérias com pagamento seguro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorePage,
});

/** Converte o idioma da matéria no idioma da interface usado pelo filtro. */
function normalizeSubjectLang(value: string | null | undefined): string {
  const v = (value ?? "pt").toLowerCase();
  if (v.startsWith("pt")) return v === "pt-pt" ? "pt-PT" : "pt";
  if (v.startsWith("es")) return "es";
  if (v.startsWith("en")) return "en";
  if (v.startsWith("fr")) return "fr";
  if (v.startsWith("it")) return "it";
  if (v.startsWith("de")) return "de";
  return "pt";
}

function StorePage() {
  const tBase = useT().store;
  const tp = useT().pricing;
  const { lang, extLang } = useLang();
  const od = useOverlayD();
  const locTag = extLang || (lang === "pt" ? "pt-BR" : lang);
  const tpl = (key: string, vars: Record<string, string>, fallback: string) => {
    const s = od?.[`store.${key}`];
    return s ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : fallback;
  };
  const t = {
    ...tBase,
    accessDays: (n: number) => tpl("accessDaysTpl", { n: n.toLocaleString(locTag) }, tBase.accessDays(n)),
    contentUpdated: (d: string) => tpl("contentUpdatedTpl", { d }, tBase.contentUpdated(d)),
    coinsQty: (n: string) => tpl("coinsQtyTpl", { n }, tBase.coinsQty(n)),
  };
  const dateFmt = (v: string | number | Date) => new Date(v).toLocaleDateString(locTag);
  const numFmt = (n: number) => n.toLocaleString(locTag);
  const qc = useQueryClient();
  const catalogFn = useServerFn(storeCatalog);
  const claimFn = useServerFn(claimOwnerPack);
  const createSubjectCheckoutFn = useServerFn(createSubjectCheckout);
  const { openCheckout, loading, checkoutBlocked } = usePaddleCheckout();
  const confirm = useCheckoutConfirmation();
  const { subscription, isActive } = useSubscription();
  const billing = useAiBillingInfo();

  const deliverFn = useServerFn(ensureSubjectDelivery);
  const grantsFn = useServerFn(mySubjectGrants);
  const renewModeFn = useServerFn(setRenewMode);

  const catalog = useQuery({ queryKey: ["store-catalog"], queryFn: () => catalogFn({}), staleTime: 15_000 });
  const grants = useQuery({ queryKey: ["subject-grants"], queryFn: () => grantsFn({}), staleTime: 15_000 });

  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [renewChoice, setRenewChoice] = useState<"keep" | "overwrite">("keep");
  const [buyersFor, setBuyersFor] = useState<string | null>(null);
  const autoDelivered = useRef(new Set<string>());

  const buyersFn = useServerFn(packBuyers);
  const buyers = useQuery({
    queryKey: ["pack-buyers", buyersFor],
    queryFn: () => buyersFn({ data: { productId: buyersFor as string } }),
    enabled: !!buyersFor,
  });


  const data = catalog.data;
  const coins = (data?.products ?? []).filter((p) => p.kind === "coins");
  const allPacks = (data?.products ?? []).filter((p) => p.kind !== "coins");

  // Filtros: país escolhido → matérias no idioma daquele país.
  const tf = useT().storeFilter;
  const [country, setCountry] = useState<string>(defaultCountryForLang(lang));
  const countryList = sortedCountries((extLang || lang) as typeof lang);
  const countryLang = findCountry(country)?.lang ?? "pt";
  const langOf = (p: { subjectLanguage?: string | null }) => normalizeSubjectLang(p.subjectLanguage);
  const packsOfCountry = allPacks.filter((p) => langOf(p) === countryLang);
  const [subjectId, setSubjectId] = useState<string>("all");
  const packs =
    subjectId === "all" ? packsOfCountry : packsOfCountry.filter((p) => p.id === subjectId);

  const purchaseOf = (productId: string) =>
    (data?.purchases ?? [])
      .filter((p) => p.product_id === productId && new Date(p.expires_at).getTime() > Date.now())
      .sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime())[0];

  const grantOf = (productId: string) => (grants.data ?? []).find((g) => g.product_id === productId);

  async function deliver(productId: string, mode?: "keep" | "overwrite") {
    setBusyPack(productId);
    try {
      const r = await deliverFn({ data: { productId, ...(mode ? { mode } : {}) } });
      toast.success(
        mode === "overwrite"
          ? t.updatedAuthor
          : r.added > 0
            ? t.updatedAdded(r.added)
            : t.upToDate,
      );
      qc.invalidateQueries({ queryKey: ["subject-grants"] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["study-queue"] });
    } catch (e: any) {
      toast.error(e?.message ?? t.updateFail);
    } finally {
      setBusyPack(null);
    }
  }

  // Entrega automática logo após a compra: o aluno recebe a matéria inteira.
  useEffect(() => {
    if (!data || !grants.data) return;
    for (const p of data.products) {
      if (p.kind === "coins" || !p.access_subject_id) continue;
      const purchase = (data.purchases ?? [])
        .filter((x) => x.product_id === p.id && new Date(x.expires_at).getTime() > Date.now())
        .sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())[0];
      if (!purchase) continue;
      const g = (grants.data ?? []).find((x) => x.product_id === p.id);
      // Primeira entrega ou renovação recém-paga (aplica a escolha feita antes do pagamento).
      const needsSync =
        !g?.copy_subject_id ||
        !g.last_synced_at ||
        new Date(g.last_synced_at).getTime() < new Date(purchase.purchased_at).getTime();
      if (needsSync && !autoDelivered.current.has(p.id)) {
        autoDelivered.current.add(p.id);
        void deliver(p.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, grants.data]);

  async function confirmRenew() {
    const productId = renewFor;
    if (!productId) return;
    try {
      await renewModeFn({ data: { productId, mode: renewChoice } });
    } catch {
      /* segue para o pagamento mesmo assim */
    }
    setRenewFor(null);
    await buy(productId);
  }

  async function buy(productId: string) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    const product = (data?.products ?? []).find((p) => p.id === productId);
    if (!product) return;
    // Matérias: a cobrança é criada no servidor com o nome da matéria no idioma do
    // comprador, para a fatura ficar clara. Se falhar, segue pelo preço do catálogo.
    if (product.kind !== "coins") {
      try {
        const { transactionId } = await createSubjectCheckoutFn({
          data: { productId: product.id, lang, environment: getPaddleEnvironment() },
        });
        openCheckout({
          transactionId,
          successUrl: `${window.location.origin}/store?checkout=success`,
        });
        return;
      } catch (e) {
        console.error("checkout nomeado falhou, usando o preço do catálogo", e);
      }
    }
    openCheckout({
      priceId: product.paddle_price_id,
      customerEmail: user.email ?? undefined,
      customData: { userId: user.id, productId: product.id },
      successUrl: `${window.location.origin}/store?checkout=success`,
    });
  }

  async function buyPlan(priceId: CommercePriceId) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    await openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      customData: { userId: user.id },
      successUrl: `${window.location.origin}/store?checkout=success`,
    });
  }

  async function claim(productId: string) {
    try {
      await claimFn({ data: { productId } });
      toast.success(t.claimed);
      qc.invalidateQueries({ queryKey: ["store-catalog"] });
    } catch (e: any) {
      toast.error(e?.message ?? t.claimFail);
    }
  }

  return (
    <>
      <PaymentTestModeBanner />
      <div className="px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <CheckoutPendingNotice show={checkoutBlocked} />
          <CheckoutConfirmingNotice show={confirm.waiting} label={confirm.waitingLabel} />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-serif text-foreground">
                <ShoppingBag className="h-6 w-6 text-primary" /> {t.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.subtitle}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.balance}</p>
              <p className="flex items-center gap-1.5 text-xl font-semibold text-foreground">
                <Coins className="h-4 w-4 text-primary" />
                {billing.data ? numFmt(billing.data.balance) : catalog.isLoading ? "…" : numFmt(data?.balance ?? 0)}
                <span className="text-xs font-normal text-muted-foreground">{t.coinsWord}</span>
              </p>
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Lock className="h-3.5 w-3.5" /> {t.secure}
            <PaddleTrustPopover label={t.securedBy} />
          </div>


          <section className="mt-8" aria-labelledby="store-pro-plans">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="store-pro-plans" className="text-lg font-serif text-foreground">{tp.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{tp.subtitle}</p>
              </div>
              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> {subscriptionPlanTier(subscription) === "pro2" ? tp.pro2Active : tp.proActive}
                </span>
              )}
            </div>
            {isActive && <p className="mb-3 text-xs text-muted-foreground">{tp.switchBlocked}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {COMMERCE_PLANS.map((plan) => (
                <CommercePlanCard key={plan.priceId} plan={plan}
                  active={isCurrentCommercePlan(plan, subscription, isActive)}
                  disabled={loading || isActive} pending={loading}
                  onClick={() => buyPlan(plan.priceId)} />
              ))}
            </div>
            <MoneyBackGuarantee className="mt-6" />
          </section>

          {catalog.isLoading && (
            <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t.loading}
            </div>
          )}

          {catalog.isError && (
            <p className="mt-10 text-sm text-muted-foreground">{t.error}</p>
          )}

          {data && (
            <>
              <section className="mt-8">
                <h2 className="text-lg font-serif text-foreground mb-1">{t.coinsTitle}</h2>
                <p className="mb-3 text-sm text-muted-foreground">
                  {t.coinsDesc}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {coins.map((p) => (
                    <article key={p.id} className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-primary" />
                        <h3 className="min-w-0 font-serif text-foreground">{p.name}</h3>
                        <CommerceItemInfo label={t.coinsInfoTitle}><p>{t.coinsInfo}</p></CommerceItemInfo>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{t.coinCardDesc}</p>
                      <p className="mt-3 text-2xl font-semibold text-foreground">{p.price_label}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.coinsQty(numFmt(p.coins_amount ?? 0))}
                      </p>
                      <Button className="mt-4 w-full" disabled={loading} onClick={() => buy(p.id)}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.buy}
                      </Button>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className="text-lg font-serif text-foreground">{t.packsTitle}</h2>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tf.countryLabel}</Label>
                      <Select
                        value={country}
                        onValueChange={(v) => {
                          setCountry(v);
                          setSubjectId("all");
                        }}
                      >
                        <SelectTrigger className="w-full sm:w-[220px]" aria-label={tf.countryLabel}>
                          <SelectValue placeholder={tf.countryPh} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {countryList.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="inline-flex items-center gap-2"><FlagIcon flag={c.flag} /> {c.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tf.subjectLabel}</Label>
                      <Select value={subjectId} onValueChange={setSubjectId}>
                        <SelectTrigger className="w-full sm:w-[240px]" aria-label={tf.subjectLabel}>
                          <SelectValue placeholder={tf.subjectPh} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="all">{tf.allSubjects}</SelectItem>
                          {packsOfCountry.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                {packs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    {packsOfCountry.length === 0 ? tf.empty : t.noPacks}
                  </div>

                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {packs.map((p) => {
                      const owned = purchaseOf(p.id);
                      return (
                        <article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                          {p.image_url && (
                            <img src={p.image_url} alt={p.name} className="h-32 w-full object-cover" />
                          )}
                          <div className="p-5">
                            <div className="flex items-center gap-2">
                              <Package className="h-5 w-5 text-primary" />
                              <h3 className="min-w-0 font-serif text-foreground">{p.name}</h3>
                              <CommerceItemInfo label={t.packsInfoTitle}><p>{t.packsInfo(numFmt(p.validity_days ?? 365))}</p></CommerceItemInfo>
                            </div>
                            {p.description && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {p.description === "Acesso completo ao conteúdo oficial desta matéria."
                                  ? t.subjectPackDesc
                                  : p.description}
                              </p>
                            )}
                            <p className="mt-3 text-2xl font-semibold text-foreground">{p.price_label}</p>
                            <p className="text-xs text-muted-foreground">
                              {t.accessDays(p.validity_days ?? 365)}
                            </p>
                            {p.contentUpdatedAt && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t.contentUpdated(dateFmt(p.contentUpdatedAt))}
                              </p>
                            )}

                            {owned ? (
                              <>
                                {data.isOwner ? (
                                  <Button
                                    variant="secondary"
                                    className="mt-4 w-full justify-start gap-1.5 bg-primary/10 text-primary hover:bg-primary/20"
                                    onClick={() => setBuyersFor(p.id)}
                                  >
                                    <Users className="h-4 w-4" /> {t.seeClients}
                                  </Button>
                                ) : (
                                  <p className="mt-4 flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                                    <ShieldCheck className="h-4 w-4" /> {t.releasedUntil(dateFmt(owned.expires_at))}
                                  </p>
                                )}

                                {grantOf(p.id)?.copy_subject_id ? (
                                  <>
                                    <Button
                                      variant="secondary"
                                      className="mt-3 w-full"
                                      disabled={busyPack === p.id}
                                      onClick={() => deliver(p.id, "keep")}
                                    >
                                      {busyPack === p.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <RefreshCw className="mr-2 h-4 w-4" /> {t.fetchUpdates}
                                        </>
                                      )}
                                    </Button>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {t.changesPreserved}
                                    </p>
                                  </>
                                ) : (
                                  <Button
                                    className="mt-3 w-full"
                                    disabled={busyPack === p.id}
                                    onClick={() => deliver(p.id, "keep")}
                                  >
                                    {busyPack === p.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Download className="mr-2 h-4 w-4" /> {t.receiveSubject}
                                      </>
                                    )}
                                  </Button>
                                )}
                              </>
                            ) : data.isOwner ? (
                              <Button variant="secondary" className="mt-4 w-full" onClick={() => claim(p.id)}>
                                {t.claimFree}
                              </Button>
                            ) : grantOf(p.id)?.copy_subject_id ? (
                              <Button
                                className="mt-4 w-full"
                                disabled={loading}
                                onClick={() => {
                                  setRenewChoice("keep");
                                  setRenewFor(p.id);
                                }}
                              >
                                {t.renewYear}
                              </Button>
                            ) : (
                              <Button className="mt-4 w-full" disabled={loading} onClick={() => buy(p.id)}>
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.buy}
                              </Button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <p className="mt-8 text-xs text-muted-foreground">
                {t.needUnlimited}{" "}
                <Link to="/pricing" className="underline">{t.plansLink}</Link>.
              </p>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!renewFor} onOpenChange={(o) => !o && setRenewFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.renewTitle}</DialogTitle>
            <DialogDescription>
              {t.renewDesc}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setRenewChoice("keep")}
              className={`w-full rounded-xl border p-4 text-left ${
                renewChoice === "keep" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <p className="font-medium text-foreground">{t.keepTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.keepDesc}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setRenewChoice("overwrite")}
              className={`w-full rounded-xl border p-4 text-left ${
                renewChoice === "overwrite" ? "border-destructive bg-destructive/5" : "border-border"
              }`}
            >
              <p className="font-medium text-foreground">{t.overwriteTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.overwriteDesc}
              </p>
            </button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewFor(null)}>
              {t.cancel}
            </Button>
            <Button onClick={confirmRenew} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.continuePayment}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!buyersFor} onOpenChange={(o) => !o && setBuyersFor(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.clientsTitle}</DialogTitle>
            <DialogDescription>
              {packs.find((p) => p.id === buyersFor)?.name ?? ""} — {t.clientsDesc}
            </DialogDescription>
          </DialogHeader>

          {buyers.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t.clientsLoading}
            </div>
          ) : (buyers.data?.buyers ?? []).length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">{t.noClients}</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">{t.thClient}</th>
                    <th className="p-2 text-left">{t.thPurchase}</th>
                    <th className="p-2 text-left">{t.thExpire}</th>
                    <th className="p-2 text-left">{t.thStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {(buyers.data?.buyers ?? []).map((b, i) => (
                    <tr key={`${b.email}-${i}`} className="border-t border-border">
                      <td className="p-2 text-foreground">{b.email}</td>
                      <td className="p-2 text-muted-foreground">
                        {dateFmt(b.purchasedAt)}
                      </td>
                      <td className="p-2 text-muted-foreground">
                        {dateFmt(b.expiresAt)}
                      </td>
                      <td className="p-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            b.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {b.active ? t.active : t.expired}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBuyersFor(null)}>
              {t.close}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}

