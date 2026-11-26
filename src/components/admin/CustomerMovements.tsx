import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Receipt } from "lucide-react";
import { T } from "@/lib/i18n-ui";
import { useLang } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminCustomerMovements, type CustomerMovement } from "@/lib/admin-movements.functions";

const FILTERS = ["todos", "ativa", "reembolsada", "expirada", "cancelada"] as const;
const badge: Record<CustomerMovement["status"], string> = {
  ativa: "bg-primary/15 text-primary",
  expirada: "bg-muted text-muted-foreground",
  reembolsada: "bg-destructive/15 text-destructive",
  "reembolso parcial": "bg-destructive/10 text-destructive",
  cancelada: "bg-muted text-muted-foreground",
  "conta excluída": "bg-muted text-muted-foreground",
};
const statusLabels: Record<CustomerMovement["status"], string> = {
  ativa: "Ativa",
  expirada: "Expirada",
  reembolsada: "Reembolsada",
  "reembolso parcial": "Reembolso parcial",
  cancelada: "Cancelada",
  "conta excluída": "Conta excluída",
};
const kindLabels: Record<CustomerMovement["kind"], string> = {
  compra: "Compra",
  assinatura: "Assinatura",
  arquivado: "Arquivado",
};
const filterLabels: Record<(typeof FILTERS)[number], string> = {
  todos: "Todos",
  ativa: "Ativa",
  reembolsada: "Reembolsada",
  expirada: "Expirada",
  cancelada: "Cancelada",
};

export function CustomerMovements() {
  const { lang, extLang } = useLang();
  const locale = extLang ?? (lang === "pt" ? "pt-BR" : lang);
  const formatDate = (v: string | null) => (v ? new Date(v).toLocaleDateString(locale) : "—");
  const formatMoney = (c: number | null, cur: string | null) =>
    c == null
      ? "—"
      : (c / 100).toLocaleString(locale, { style: "currency", currency: cur || "USD" });
  const fn = useServerFn(adminCustomerMovements);
  const q = useQuery({ queryKey: ["admin-movements"], queryFn: () => fn() });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("todos");

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => {
      if (filter === "reembolsada" && !r.refundedAt) return false;
      if (filter !== "todos" && filter !== "reembolsada" && r.status !== filter) return false;
      return !s || [r.name, r.email, r.product].some((v) => v?.toLowerCase().includes(s));
    });
  }, [q.data, search, filter]);

  const refunds = (q.data ?? []).filter((r) => r.refundedAt).length;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 font-serif text-foreground">
        <Receipt className="h-4 w-4 text-primary" /> {T("Movimentos dos clientes")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {T(
          "Quem comprou, o quê, quanto pagou, validade e reembolsos (acesso revogado). {n} reembolso(s) no total.",
          { n: refunds },
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          placeholder={T("Buscar nome, e-mail ou produto")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {T(filterLabels[f])}
          </Button>
        ))}
      </div>
      {q.isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {T("Carregando…")}
        </div>
      ) : q.error ? (
        <p className="mt-4 text-sm text-destructive">
          {T("Não foi possível carregar os movimentos.")}
        </p>
      ) : (
        <div className="mt-4 max-h-[520px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
              <tr>
                {[
                  "Cliente",
                  "Produto",
                  "Tipo",
                  "Pago",
                  "Compra",
                  "Expira",
                  "Reembolso",
                  "Situação",
                ].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                    {T(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="text-foreground">{r.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.email || "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.product}</td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">
                    {T(kindLabels[r.kind])}
                    {r.environment === "sandbox" ? ` · ${T("Teste")}` : ""}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatMoney(r.amountCents, r.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(r.purchasedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(r.expiresAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.refundedAt ? (
                      <>
                        {formatDate(r.refundedAt)}
                        {r.refundedCents ? (
                          <div className="text-xs text-muted-foreground">
                            {formatMoney(r.refundedCents, r.currency)}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${badge[r.status]}`}
                    >
                      {T(statusLabels[r.status])}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    {T("Nenhum movimento encontrado.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
