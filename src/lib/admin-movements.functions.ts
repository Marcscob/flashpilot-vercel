import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "@/lib/app-manager";

export type CustomerMovement = {
  id: string;
  kind: "compra" | "assinatura" | "arquivado";
  name: string | null;
  email: string | null;
  product: string;
  amountCents: number | null;
  currency: string | null;
  purchasedAt: string | null;
  expiresAt: string | null;
  refundedAt: string | null;
  refundedCents: number;
  status: "ativa" | "expirada" | "reembolsada" | "reembolso parcial" | "cancelada" | "conta excluída";
  environment: string | null;
};

/** Lista unificada de movimentos dos clientes (compras, assinaturas, reembolsos/revogações). Só AppManager. */
export const adminCustomerMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomerMovement[]> => {
    if (!isAppManagerIdentity(context.claims)) throw new Error("Área restrita ao AppManager.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [ups, subs, arch, prods, profs] = await Promise.all([
      supabaseAdmin.from("user_purchases").select("id,user_id,product_id,amount_cents,currency,environment,purchased_at,expires_at,refunded_at,refunded_amount_cents").order("purchased_at", { ascending: false }).limit(2000),
      supabaseAdmin.from("subscriptions").select("id,user_id,product_id,status,current_period_end,cancel_at_period_end,environment,created_at").order("created_at", { ascending: false }).limit(2000),
      supabaseAdmin.from("billing_archive").select("id,email,product_id,amount_cents,currency,environment,purchased_at,expires_at,refunded_at").order("archived_at", { ascending: false }).limit(1000),
      supabaseAdmin.from("store_products").select("id,name"),
      supabaseAdmin.from("profiles").select("user_id,full_name").limit(10000),
    ]);

    const emails = new Map<string, string>();
    for (let page = 1; page <= 20; page++) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      const users = data?.users ?? [];
      users.forEach((u) => emails.set(u.id, u.email ?? ""));
      if (users.length < 1000) break;
    }
    const names = new Map((profs.data ?? []).map((p) => [p.user_id, p.full_name]));
    const prodName = new Map((prods.data ?? []).map((p) => [p.id, p.name]));
    const label = (id: string | null) =>
      !id ? "—" : id === "pro_2" ? "FlashPilot Pro 2" : id === "pro" ? "FlashPilot Pro" : prodName.get(id) ?? id;
    const now = Date.now();
    const out: CustomerMovement[] = [];

    for (const p of ups.data ?? []) {
      const refunded = p.refunded_amount_cents ?? 0;
      const full = p.refunded_at && (p.amount_cents == null || refunded >= p.amount_cents);
      out.push({
        id: `p-${p.id}`, kind: "compra", name: names.get(p.user_id) ?? null, email: emails.get(p.user_id) ?? null,
        product: label(p.product_id), amountCents: p.amount_cents, currency: p.currency,
        purchasedAt: p.purchased_at, expiresAt: p.expires_at, refundedAt: p.refunded_at, refundedCents: refunded,
        status: full ? "reembolsada" : p.refunded_at ? "reembolso parcial" : new Date(p.expires_at).getTime() < now ? "expirada" : "ativa",
        environment: p.environment,
      });
    }
    for (const s of subs.data ?? []) {
      const active = ["active", "trialing", "past_due"].includes(s.status);
      out.push({
        id: `s-${s.id}`, kind: "assinatura", name: names.get(s.user_id) ?? null, email: emails.get(s.user_id) ?? null,
        product: label(s.product_id), amountCents: null, currency: null,
        purchasedAt: s.created_at, expiresAt: s.current_period_end, refundedAt: null, refundedCents: 0,
        status: active ? "ativa" : s.status === "canceled" ? "cancelada" : "expirada", environment: s.environment,
      });
    }
    for (const a of arch.data ?? []) {
      out.push({
        id: `a-${a.id}`, kind: "arquivado", name: null, email: a.email, product: label(a.product_id),
        amountCents: a.amount_cents, currency: a.currency, purchasedAt: a.purchased_at, expiresAt: a.expires_at,
        refundedAt: a.refunded_at, refundedCents: 0, status: "conta excluída", environment: a.environment,
      });
    }
    out.sort((x, y) => (y.purchasedAt ?? "").localeCompare(x.purchasedAt ?? ""));
    return out;
  });
