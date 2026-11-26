import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminOverview,
  adminSaveActionCost,
  adminSaveProduct,
  adminSubjectPacks,
  adminSaveSubjectPack,
  adminPublishAllSubjectPacks,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Coins,
  FileText,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { communityAuditOverview, runCommunityAudit } from "@/lib/ugc.functions";
import { reconcileRefunds, reconcilePurchases } from "@/lib/billing.functions";
import { AiFallbackLog } from "@/components/admin/AiFallbackLog";
import { UsageReport } from "@/components/admin/UsageReport";
import { CommunityCuration } from "@/components/admin/CommunityCuration";
import { GameCuration } from "@/components/admin/GameCuration";
import { CustomerMovements } from "@/components/admin/CustomerMovements";
import { T } from "@/lib/i18n-ui";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel do AppManager — Flash Pilot" },
      {
        name: "description",
        content: "Receita, assinantes, produtos da Loja e custos das ações do PilotAI.",
      },
      { property: "og:title", content: "Painel do AppManager — Flash Pilot" },
      {
        property: "og:description",
        content: "Receita, assinantes e custos do PilotAI do Flash Pilot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { lang, extLang } = useLang();
  const locale = extLang ?? (lang === "pt" ? "pt-BR" : lang);
  const number = (value: number) => value.toLocaleString(locale);
  const usd = (cents: number) =>
    (cents / 100).toLocaleString(locale, { style: "currency", currency: "USD" });
  const qc = useQueryClient();
  const overviewFn = useServerFn(adminOverview);
  const saveProduct = useServerFn(adminSaveProduct);
  const saveCost = useServerFn(adminSaveActionCost);

  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn({}),
    staleTime: 15_000,
    retry: false,
  });
  const data = q.data;

  const [costDraft, setCostDraft] = useState<
    Record<string, { coins: string; est: string; margin: string }>
  >({});
  const [prodDraft, setProdDraft] = useState<Record<string, { label: string; order: string }>>({});

  if (q.isError) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        {T("Esta área é restrita ao AppManager.")}
      </div>
    );
  }

  async function commitCost(
    id: string,
    current: { coinsCost: number; estCostUsd: number; marginAlertPct: number },
  ) {
    const d = costDraft[id];
    try {
      await saveCost({
        data: {
          id,
          coins_cost:
            d?.coins !== undefined && d.coins !== "" ? Number(d.coins) : current.coinsCost,
          est_cost_usd: d?.est !== undefined && d.est !== "" ? Number(d.est) : current.estCostUsd,
          margin_alert_pct:
            d?.margin !== undefined && d.margin !== ""
              ? Math.round(Number(d.margin))
              : current.marginAlertPct,
        },
      });
      toast.success(T("Custo atualizado."));
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e: any) {
      toast.error(e?.message ?? T("Não foi possível salvar."));
    }
  }

  async function commitProduct(id: string, patch: Record<string, unknown>) {
    try {
      await saveProduct({ data: { id, ...patch } as any });
      toast.success(T("Produto atualizado."));
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["store-catalog"] });
    } catch (e: any) {
      toast.error(e?.message ?? T("Não foi possível salvar."));
    }
  }

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-serif text-foreground">
          <BarChart3 className="h-6 w-6 text-primary" /> {T("Painel do AppManager")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {T("Receita, assinantes, produtos da Loja e o custo real de cada ação do PilotAI.")}
        </p>
        <Link
          to="/blog-admin"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-amber-400 hover:text-amber-600"
        >
          <FileText className="h-4 w-4" /> {T("Painel do Blog")}
        </Link>

        <CustomerMovements />
        <UsageReport />
        <AiFallbackLog />
        <PurchaseSyncCard />
        <RefundSyncCard />

        {q.isLoading && (
          <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {T("Carregando o painel…")}
          </div>
        )}

        {data && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={T("Receita total")} value={usd(data.revenueCents)} />
              <Stat label={T("Receita (30 dias)")} value={usd(data.revenue30Cents)} />
              <Stat
                label={T("Assinantes ativos")}
                value={number(data.activeSubscribers)}
                icon={<Users className="h-4 w-4 text-primary" />}
              />
              <Stat label={T("Pacotes ativos")} value={number(data.activePackAccesses)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat label={T("Transações")} value={number(data.transactions)} />
              <Stat label={T("Ações do PilotAI (30 dias)")} value={number(data.aiCalls30d)} />
              <Stat
                label={T("Custo do PilotAI (30 dias)")}
                value={data.aiCost30dUsd.toLocaleString(locale, {
                  style: "currency",
                  currency: "USD",
                })}
              />
            </div>

            {data.subscribersByPlan.length > 0 && (
              <section className="mt-8 border-t border-border pt-5">
                <h2 className="font-serif text-foreground">{T("Assinantes por plano")}</h2>
                <ul className="mt-3 divide-y divide-border text-sm">
                  {data.subscribersByPlan.map((s) => (
                    <li
                      key={s.productId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="text-foreground">
                        {s.productId === "pro_2" ? "FlashPilot Pro 2" : "FlashPilot Pro"}
                      </span>
                      <span className="text-muted-foreground">
                        {number(s.count)} · {T("Real")}: {number(s.live)} · {T("Teste")}:{" "}
                        {number(s.sandbox)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-serif text-foreground">
                <Coins className="h-5 w-5 text-primary" /> {T("Custo das ações do PilotAI")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {T(
                  "O alerta aparece quando o custo real médio passa do custo estimado mais a margem definida.",
                )}
              </p>

              <div className="mt-4 space-y-3">
                {data.actions.map((a) => {
                  const d = costDraft[a.id];
                  return (
                    <div
                      key={a.id}
                      className={
                        "rounded-xl border p-4 " +
                        (a.alert ? "border-destructive/60 bg-destructive/5" : "border-border")
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">
                          {a.label}
                          {a.alert && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                              <AlertTriangle className="h-3 w-3" /> {T("margem estourada")}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {number(a.calls30d)} {T("usos · custo médio")}{" "}
                          {a.avgCostUsd === null
                            ? "—"
                            : a.avgCostUsd.toLocaleString(locale, {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 5,
                              })}
                          {a.overByPct !== null &&
                            ` · ${a.overByPct >= 0 ? "+" : ""}${a.overByPct.toFixed(0)}% vs estimado`}
                        </p>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <Field label="FlashCoins">
                          <Input
                            inputMode="decimal"
                            value={d?.coins ?? String(a.coinsCost)}
                            onChange={(e) =>
                              setCostDraft((s) => ({
                                ...s,
                                [a.id]: {
                                  coins: e.target.value,
                                  est: s[a.id]?.est ?? String(a.estCostUsd),
                                  margin: s[a.id]?.margin ?? String(a.marginAlertPct),
                                },
                              }))
                            }
                          />
                        </Field>
                        <Field label={T("Custo estimado (US$)")}>
                          <Input
                            inputMode="decimal"
                            value={d?.est ?? String(a.estCostUsd)}
                            onChange={(e) =>
                              setCostDraft((s) => ({
                                ...s,
                                [a.id]: {
                                  coins: s[a.id]?.coins ?? String(a.coinsCost),
                                  est: e.target.value,
                                  margin: s[a.id]?.margin ?? String(a.marginAlertPct),
                                },
                              }))
                            }
                          />
                        </Field>
                        <Field label={T("Margem de alerta (%)")}>
                          <Input
                            inputMode="numeric"
                            value={d?.margin ?? String(a.marginAlertPct)}
                            onChange={(e) =>
                              setCostDraft((s) => ({
                                ...s,
                                [a.id]: {
                                  coins: s[a.id]?.coins ?? String(a.coinsCost),
                                  est: s[a.id]?.est ?? String(a.estCostUsd),
                                  margin: e.target.value,
                                },
                              }))
                            }
                          />
                        </Field>
                        <div className="flex items-end">
                          <Button className="w-full" onClick={() => commitCost(a.id, a)}>
                            {T("Salvar")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-border bg-card p-5">
              <h2 className="font-serif text-foreground">{T("Produtos da Loja")}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {T(
                  "O texto do preço e a ordem podem ser editados aqui. Para criar um produto novo ou mudar o valor cobrado, peça no chat — o valor precisa ser criado também no Paddle.",
                )}
              </p>
              <div className="mt-4 space-y-3">
                {data.products.map((p) => {
                  const d = prodDraft[p.id];
                  return (
                    <div key={p.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground">
                          {p.name} <span className="text-xs text-muted-foreground">({p.kind})</span>
                        </p>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          {T("Ativo")}
                          <Switch
                            checked={!!p.is_active}
                            onCheckedChange={(v) => commitProduct(p.id, { is_active: v })}
                          />
                        </label>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <Field label={T("Preço exibido")}>
                          <Input
                            value={d?.label ?? p.price_label}
                            onChange={(e) =>
                              setProdDraft((s) => ({
                                ...s,
                                [p.id]: {
                                  label: e.target.value,
                                  order: s[p.id]?.order ?? String(p.order_index ?? 0),
                                },
                              }))
                            }
                          />
                        </Field>
                        <Field label={T("Ordem")}>
                          <Input
                            inputMode="numeric"
                            value={d?.order ?? String(p.order_index ?? 0)}
                            onChange={(e) =>
                              setProdDraft((s) => ({
                                ...s,
                                [p.id]: {
                                  label: s[p.id]?.label ?? p.price_label,
                                  order: e.target.value,
                                },
                              }))
                            }
                          />
                        </Field>
                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            onClick={() =>
                              commitProduct(p.id, {
                                price_label: d?.label ?? p.price_label,
                                order_index: Math.max(
                                  0,
                                  Math.round(Number(d?.order ?? p.order_index ?? 0)) || 0,
                                ),
                              })
                            }
                          >
                            {T("Salvar")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <CommunityCuration />
          <GameCuration />

            <SubjectPacks />

            <CommunityAudit />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Matérias do AppManager publicadas na Loja como pacotes pagos (preço em dólar). */
function SubjectPacks() {
  const { lang, extLang } = useLang();
  const locale = extLang ?? (lang === "pt" ? "pt-BR" : lang);
  const number = (value: number) => value.toLocaleString(locale);
  const qc = useQueryClient();
  const listFn = useServerFn(adminSubjectPacks);
  const saveFn = useServerFn(adminSaveSubjectPack);
  const publishAllFn = useServerFn(adminPublishAllSubjectPacks);
  const [publishingAll, setPublishingAll] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<string, { available: boolean; paddlePriceId?: string }>
  >({});
  const [saving, setSaving] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-subject-packs"],
    queryFn: () => listFn({}),
    staleTime: 15_000,
    retry: false,
  });
  const subjects = q.data?.subjects ?? [];

  async function save(s: {
    subjectId: string;
    available: boolean;
    cards: number;
    paddlePriceId: string | null;
  }) {
    const d = drafts[s.subjectId];
    const available = d?.available ?? s.available;
    const paddlePriceId = (d?.paddlePriceId ?? s.paddlePriceId ?? "").trim();
    if (available && !s.cards) {
      toast.error(T("Matéria sem cards não pode ir para a Loja."));
      return;
    }
    setSaving(s.subjectId);
    try {
      await saveFn({
        data: { subjectId: s.subjectId, available, paddlePriceId: paddlePriceId || undefined },
      });
      toast.success(
        available ? T("Matéria disponibilizada na Loja.") : T("Matéria ocultada da Loja."),
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[s.subjectId];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["admin-subject-packs"] });
      qc.invalidateQueries({ queryKey: ["store-catalog"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e: any) {
      toast.error(e?.message ?? T("Não foi possível salvar."));
    } finally {
      setSaving(null);
    }
  }

  async function publishAll() {
    setPublishingAll(true);
    try {
      const r = await publishAllFn({ data: {} });
      toast.success(T("{n} matéria(s) na Loja.", { n: r.published }));
      if (r.skipped) toast.message(T("{n} sem cards ficaram de fora.", { n: r.skipped }));
      setDrafts({});
      qc.invalidateQueries({ queryKey: ["admin-subject-packs"] });
      qc.invalidateQueries({ queryKey: ["store-catalog"] });
    } catch (e: any) {
      toast.error(e?.message ?? T("Não foi possível publicar as matérias."));
    } finally {
      setPublishingAll(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-serif text-foreground">
        <BookOpen className="h-5 w-5 text-primary" /> {T("Matérias na Loja")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {T(
          'Marque "Disponibilizar matéria" para ela aparecer na Loja para os clientes. Desmarcada, só você a vê aqui. Quem compra passa a ver automaticamente cada melhoria que você fizer no conteúdo.',
        )}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-3">
        <Button variant="secondary" disabled={publishingAll} onClick={publishAll}>
          {publishingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : T("Disponibilizar todas")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {T(
            "Liga todas as matérias com cards. O preço é automático pela quantidade de cards: até 1.000 → US$ 9,65 · 1.001 a 2.000 → US$ 14,70 · acima de 2.000 → US$ 17,90.",
          )}
        </p>
      </div>

      {q.isLoading && (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {T("Carregando matérias…")}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {subjects.map((s) => {
          const d = drafts[s.subjectId];
          const available = d?.available ?? s.available;
          return (
            <div key={s.subjectId} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">
                  {s.name}{" "}
                  <span
                    className={`mr-1 rounded-full px-2 py-0.5 text-[10px] ${available ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {available ? T("na Loja") : T("fora da Loja")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {number(s.cards)} {T("cards")}
                    {s.lastUpdate &&
                      T(" · conteúdo atualizado em {date}", {
                        date: new Date(s.lastUpdate).toLocaleDateString(locale),
                      })}
                  </span>
                </p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {T("Disponibilizar matéria")}
                  <Switch
                    checked={available}
                    onCheckedChange={(v) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [s.subjectId]: {
                          paddlePriceId: prev[s.subjectId]?.paddlePriceId ?? s.paddlePriceId ?? "",
                          available: v,
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <Field label={T("Preço automático")}>
                  <Input value={`${s.tierLabel} · ${s.tierRange}`} disabled />
                </Field>
                <Field label={T("Preço no Paddle (opcional)")}>
                  <Input
                    placeholder={T("padrão: {tier}", { tier: s.tierLabel })}
                    value={d?.paddlePriceId ?? s.paddlePriceId ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [s.subjectId]: {
                          paddlePriceId: e.target.value,
                          available: prev[s.subjectId]?.available ?? s.available,
                        },
                      }))
                    }
                  />
                </Field>
                <Field label={T("Validade")}>
                  <Input value={T("365 dias")} disabled />
                </Field>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={saving === s.subjectId}
                    onClick={() => save(s)}
                  >
                    {saving === s.subjectId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {!q.isLoading && subjects.length === 0 && (
          <p className="text-sm text-muted-foreground">{T("Nenhuma matéria encontrada.")}</p>
        )}
      </div>
    </section>
  );
}

/** Etapa 6 — auditoria dos cards da comunidade (3 pessoas diferentes antes do PilotAI). */
function CommunityAudit() {
  const { lang, extLang } = useLang();
  const locale = extLang ?? (lang === "pt" ? "pt-BR" : lang);
  const number = (value: number) => value.toLocaleString(locale);
  const qc = useQueryClient();
  const overviewFn = useServerFn(communityAuditOverview);
  const runFn = useServerFn(runCommunityAudit);
  const [running, setRunning] = useState(false);

  const q = useQuery({
    queryKey: ["community-audit"],
    queryFn: () => overviewFn({}),
    staleTime: 15_000,
    retry: false,
  });
  const d = q.data;

  async function run() {
    setRunning(true);
    try {
      const r = await runFn({ data: { limit: 10 } });
      toast.success(
        r.checked === 0
          ? T("Nenhum card aguardando validação.")
          : T("{checked} card(s) analisados: {approved} aprovado(s), {rejected} sem selo.", {
              checked: r.checked,
              approved: r.approved,
              rejected: r.rejected,
            }),
      );
      qc.invalidateQueries({ queryKey: ["community-audit"] });
    } catch (e: any) {
      toast.error(e?.message ?? T("Não foi possível validar agora."));
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-serif text-foreground">
        <ShieldCheck className="h-5 w-5 text-primary" /> {T("Auditoria da comunidade")}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {T(
          "Um card só é enviado para o PilotAI validar depois de ser usado por {n} pessoas diferentes. Aprovado, recebe o selo de verificado; reprovado, apenas fica sem o selo. Nada é apagado e o card continua sendo do autor.",
          { n: d?.minUsers ?? 3 },
        )}
      </p>

      {d && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat label={T("Cards acompanhados")} value={number(d.tracked)} />
            <Stat label={T("Aguardando validação")} value={number(d.pending)} />
            <Stat label={T("Verificados")} value={number(d.verified)} />
          </div>

          {d.samples.length > 0 && (
            <ul className="mt-4 divide-y divide-border text-sm">
              {d.samples.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-foreground">{s.question}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {T("{n} pessoas", { n: s.users })}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Button className="mt-4" onClick={run} disabled={running || d.pending === 0}>
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {T("Validar agora")}
          </Button>
        </>
      )}
    </section>
  );
}

/** Aplica no app os reembolsos aprovados no provedor de pagamentos. */
function RefundSyncCard() {
  const fn = useServerFn(reconcileRefunds);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const out: any = await fn({} as any);
      const packs = (out?.sandbox?.packsRevoked ?? 0) + (out?.live?.packsRevoked ?? 0);
      const coins = (out?.sandbox?.coinsReversed ?? 0) + (out?.live?.coinsReversed ?? 0);
      toast.success(
        T("Reembolsos aplicados: {packs} acesso(s) cortado(s), {coins} FlashCoins estornados.", {
          packs,
          coins,
        }),
      );
    } catch (e: any) {
      toast.error(e?.message ?? T("Não foi possível sincronizar os reembolsos."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-serif text-foreground">{T("Reembolsos")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {T(
          "Depois de reembolsar uma compra no provedor de pagamentos, clique aqui para cortar o acesso à matéria e estornar os FlashCoins daquela compra. Também acontece automaticamente quando o provedor avisa o app.",
        )}
      </p>
      <Button className="mt-3" variant="secondary" disabled={busy} onClick={run}>
        {busy ? T("Sincronizando…") : T("Sincronizar reembolsos")}
      </Button>
    </section>
  );
}

/** Aplica no app as compras pagas no provedor que ainda não foram liberadas. */
function PurchaseSyncCard() {
  const fn = useServerFn(reconcilePurchases);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const out: any = await fn({} as any);
      const coins = (out?.sandbox?.coins ?? 0) + (out?.live?.coins ?? 0);
      const packs = (out?.sandbox?.packs ?? 0) + (out?.live?.packs ?? 0);
      const recorded = (out?.sandbox?.recorded ?? 0) + (out?.live?.recorded ?? 0);
      toast.success(
        T(
          "Compras sincronizadas: {recorded} pagamento(s), {coins} crédito(s) de FlashCoins, {packs} matéria(s) liberada(s).",
          { recorded, coins, packs },
        ),
      );
    } catch (e: any) {
      toast.error(e?.message ?? T("Não foi possível sincronizar as compras."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-serif text-foreground">{T("Compras")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {T(
          "Lê os pagamentos aprovados no provedor e aplica o que faltou: FlashCoins creditados e matérias liberadas. Pode rodar quantas vezes quiser — nada é liberado em dobro.",
        )}
      </p>
      <Button className="mt-3" variant="secondary" disabled={busy} onClick={run}>
        {busy ? T("Sincronizando…") : T("Sincronizar compras")}
      </Button>
    </section>
  );
}
