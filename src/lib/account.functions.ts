import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "@/lib/app-manager";

/** Painel do usuário: assinatura, FlashCoins, histórico e pacotes liberados. */
export const accountOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as any)?.email ?? "").toLowerCase();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [profile, subs, ledger, purchases, usage, products] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("flashcoins_balance, terms_accepted_at, created_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("subscriptions")
        .select("product_id, price_id, status, current_period_end, cancel_at_period_end, environment, created_at")
        .eq("user_id", context.userId)
        .in("environment", ["live", "owner", ...(process.env.PADDLE_ENV_INCLUDE_SANDBOX === "0" ? [] : ["sandbox"])])
        .order("created_at", { ascending: false })
        .limit(5),
      context.supabase
        .from("flashcoin_ledger")
        .select("id, amount, balance_after, reason, action_id, created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50),
      context.supabase
        .from("user_purchases")
        .select("id, product_id, paddle_transaction_id, purchased_at, expires_at, amount_cents, currency, environment, refunded_at")
        .eq("user_id", context.userId)
        .in("environment", ["live", "owner", ...(process.env.PADDLE_ENV_INCLUDE_SANDBOX === "0" ? [] : ["sandbox"])])
        .order("purchased_at", { ascending: false }),
      context.supabase
        .from("ai_usage")
        .select("kind, coins_cost, created_at")
        .eq("user_id", context.userId)
        .gte("created_at", since)
        .limit(2000),
      context.supabase.from("store_products").select("id, name, kind, paddle_price_id").eq("is_active", true),
    ]);

    const [payments, grants] = await Promise.all([
      context.supabase
        .from("purchases")
        .select("id, product_id, price_id, amount_cents, currency, environment, created_at, paddle_transaction_id")
        .eq("user_id", context.userId)
        .in("environment", ["live", "owner", ...(process.env.PADDLE_ENV_INCLUDE_SANDBOX === "0" ? [] : ["sandbox"])])
        .order("created_at", { ascending: false })
        .limit(100),
      context.supabase
        .from("subject_grants")
        .select("product_id, copy_subject_id, expires_at, last_synced_at")
        .eq("user_id", context.userId),
    ]);
    const { getAvailableFlashcoins } = await import("./ai-quota.server");
    const availableBalance = await getAvailableFlashcoins(context.userId);

    const nameById = new Map((products.data ?? []).map((p) => [p.id, p.name]));
    const purchaseNameByTransaction = new Map(
      (purchases.data ?? [])
        .filter((p) => p.paddle_transaction_id)
        .map((p) => [p.paddle_transaction_id, nameById.get(p.product_id) ?? p.product_id]),
    );
    // Preço → nome só quando o preço identifica um único item (as matérias compartilham faixas).
    const priceCount = new Map<string, number>();
    for (const p of products.data ?? []) {
      priceCount.set(p.paddle_price_id, (priceCount.get(p.paddle_price_id) ?? 0) + 1);
    }
    const priceToName = new Map(
      (products.data ?? [])
        .filter((p) => priceCount.get(p.paddle_price_id) === 1)
        .map((p) => [p.paddle_price_id, p.name]),
    );
    const grantByProduct = new Map((grants.data ?? []).map((g) => [g.product_id, g]));

    const byKind = new Map<string, { kind: string; count: number; coins: number }>();
    for (const row of usage.data ?? []) {
      const key = row.kind ?? "outros";
      const entry = byKind.get(key) ?? { kind: key, count: 0, coins: 0 };
      entry.count += 1;
      entry.coins += Number(row.coins_cost ?? 0);
      byKind.set(key, entry);
    }
    // Flashcard saves (and PilotAI features charged in coins) live only in the ledger.
    const { data: spent30 } = await context.supabase
      .from("flashcoin_ledger")
      .select("amount, reason, action_id")
      .eq("user_id", context.userId)
      .lt("amount", 0)
      .gte("created_at", since)
      .limit(2000);
    // Recibos são legíveis só pelo sistema; filtra estritamente pelo usuário autenticado.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: savedCards30 } = await supabaseAdmin
      .from("flashcard_save_receipts")
      .select("inserted_count")
      .eq("user_id", context.userId)
      .gte("created_at", since)
      .limit(2000);
    const cardsSaved = (savedCards30 ?? []).reduce((s, r) => s + Number(r.inserted_count ?? 0), 0);
    let cardCoins = 0;
    for (const row of spent30 ?? []) {
      const a = row.action_id ?? "";
      if (row.reason === "ai_flashcards" || a.startsWith("flashcards-save:")) {
        cardCoins += -Number(row.amount);
      } else if (a.startsWith("ai-feature:")) {
        const key = a.split(":")[1] || "outros";
        const entry = byKind.get(key) ?? { kind: key, count: 1, coins: 0 };
        entry.coins += -Number(row.amount);
        byKind.set(key, entry);
      }
    }
    if (cardsSaved > 0 || cardCoins > 0) {
      byKind.set("flashcards", { kind: "flashcards", count: cardsSaved, coins: cardCoins });
    }

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const sub = (subs.data ?? [])[0] ?? null;
    const endTs = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
    const subscriptionActive =
      !!sub &&
      ((["active", "trialing", "past_due"].includes(sub.status) && (!endTs || endTs > now)) ||
        (sub.status === "canceled" && !!endTs && endTs > now));

    return {
      email,
      isOwner: isAppManagerIdentity(context.claims),
      memberSince: profile.data?.created_at ?? null,
      termsAcceptedAt: profile.data?.terms_accepted_at ?? null,
      balance: availableBalance,
      subscription: sub,
      subscriptionActive,
      ledger: (ledger.data ?? []).map((l) => ({
        ...l,
        amount: Number(l.amount),
        balance_after: Number(l.balance_after),
      })),
      purchases: (purchases.data ?? []).map((p) => {
        const expiresTs = new Date(p.expires_at).getTime();
        const refunded = !!p.refunded_at;
        const active = !refunded && expiresTs > now;
        const daysLeft = Math.max(0, Math.ceil((expiresTs - now) / DAY));
        const grant = grantByProduct.get(p.product_id) ?? null;
        return {
          ...p,
          productName: nameById.get(p.product_id) ?? p.product_id,
          active,
          refunded,
          daysLeft,
          status: refunded ? "refunded" : !active ? "expired" : daysLeft <= 30 ? "ending" : "active",
          copySubjectId: grant?.copy_subject_id ?? null,
        };
      }),
      payments: (payments.data ?? []).map((p) => ({
        ...p,
        label:
          purchaseNameByTransaction.get(p.paddle_transaction_id) ??
          nameById.get(p.product_id) ??
          priceToName.get(p.price_id ?? "") ??
          "Compra FlashPilot",
      })),
      usage30d: [...byKind.values()].sort((a, b) => b.count - a.count),
    };
  });
