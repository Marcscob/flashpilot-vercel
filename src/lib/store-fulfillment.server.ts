import type { PaddleEnv } from "@/lib/paddle.server";

/** Erros de gravação não podem passar em silêncio: o provedor precisa repetir o aviso. */
export function must(label: string, res: any, ctx: Record<string, any> = {}) {
  const err = res?.error;
  if (err) {
    console.error(`[payments] ${label} falhou`, { ...ctx, error: err.message ?? err });
    throw new Error(`${label}: ${err.message ?? "erro"}`);
  }
}

/**
 * Concede o que foi comprado, com base no catálogo da loja (store_products).
 * Idempotente: os índices únicos por transação impedem crédito ou liberação
 * em dobro quando o mesmo pagamento é processado de novo.
 */
export async function applyStoreEffects(args: {
  client: any;
  userId: string;
  priceId: string;
  /** Item escolhido na loja (customData) — várias matérias compartilham o mesmo preço. */
  storeProductId?: string | null;
  transactionId: string;
  amountCents: number | null;
  currency: string | null;
  env: PaddleEnv;
}): Promise<{ applied: "coins" | "pack" | null }> {
  const supabase = args.client;
  const columns = "id, kind, coins_amount, validity_days";

  let product: any = null;
  if (args.storeProductId) {
    const res = await supabase.from("store_products").select(columns).eq("id", args.storeProductId).maybeSingle();
    must("consultar produto", res, { productId: args.storeProductId });
    product = res.data;
  }
  if (!product) {
    // Fallback: só serve quando o preço identifica um único item do catálogo.
    const res = await supabase.from("store_products").select(columns).eq("paddle_price_id", args.priceId);
    must("consultar produtos por preço", res, { priceId: args.priceId });
    const rows = res.data ?? [];
    if (rows.length !== 1) {
      console.error("[payments] não foi possível identificar o item comprado", {
        transactionId: args.transactionId,
        priceId: args.priceId,
        matches: rows.length,
      });
      return { applied: null };
    }
    product = rows[0];
  }

  if (product.kind === "coins") {
    const coins = Number(product.coins_amount ?? 0);
    if (coins <= 0) return { applied: null };
    must(
      "creditar FlashCoins",
      await supabase.rpc("apply_flashcoins", {
        p_user_id: args.userId,
        p_amount: coins,
        p_reason: "purchase",
        p_action_id: product.id,
        p_transaction_id: args.transactionId,
        p_adjustment_id: null,
      }),
      { transactionId: args.transactionId, userId: args.userId },
    );
    return { applied: "coins" };
  }

  const days = Number(product.validity_days ?? 365);
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  must(
    "liberar matéria",
    await supabase.from("user_purchases").upsert(
      {
        user_id: args.userId,
        product_id: product.id,
        paddle_transaction_id: args.transactionId,
        price_id: args.priceId,
        amount_cents: args.amountCents,
        currency: args.currency,
        environment: args.env,
        expires_at: expires,
      },
      { onConflict: "paddle_transaction_id,product_id" },
    ),
    { transactionId: args.transactionId, productId: product.id },
  );

  // Renovação: nunca reduz um prazo que já foi concedido ao aluno.
  must(
    "renovar acesso",
    await supabase.rpc("extend_subject_grant", {
      p_user_id: args.userId,
      p_product_id: product.id,
      p_expires_at: expires,
    }),
    { userId: args.userId, productId: product.id },
  );
  // Entrega imediata no servidor; se falhar, a Revisão/Loja tentam de novo depois.
  try {
    const { deliverSubjectForUser } = await import("@/lib/official-content.functions");
    await deliverSubjectForUser(supabase, args.userId, product.id);
  } catch (e) {
    console.error("[payments] entrega da matéria adiada", { productId: product.id, error: (e as Error).message });
  }
  return { applied: "pack" };
}
