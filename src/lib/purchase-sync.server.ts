import { gatewayFetchAll, type PaddleEnv } from "@/lib/paddle.server";
import { resolveCatalogPriceId } from "@/lib/payment-resolve.server";
import { applyStoreEffects, must } from "@/lib/store-fulfillment.server";

/**
 * Lê os pagamentos aprovados no provedor e aplica o que ainda não foi aplicado no app
 * (FlashCoins creditados, matérias liberadas, histórico de pagamentos).
 * Totalmente idempotente: nada é creditado ou liberado duas vezes.
 */
export async function reconcilePurchasesFromProvider(
  admin: any,
  env: PaddleEnv,
): Promise<{ checked: number; recorded: number; coins: number; packs: number; skipped: number }> {
  const rows = await gatewayFetchAll<Record<string, any>>(
    env,
    "/transactions?status=completed,paid&per_page=100&order_by=created_at[DESC]",
  );

  let recorded = 0;
  let coins = 0;
  let packs = 0;
  let skipped = 0;

  for (const tx of rows) {
    const transactionId = String(tx?.id ?? "");
    const userId =
      tx?.custom_data?.userId ?? (await userOfSubscription(admin, tx?.subscription_id, env));
    const item = tx?.items?.[0];
    const priceId = transactionId
      ? await resolveCatalogPriceId({
          admin,
          env,
          transactionId,
          item,
          customData: tx?.custom_data,
        })
      : null;
    if (!transactionId || !userId || !priceId) {
      skipped += 1;
      continue;
    }
    const amountCents = tx?.details?.totals?.total ? parseInt(tx.details.totals.total, 10) : null;
    const currency = tx?.currency_code ?? null;

    must(
      "registrar pagamento",
      await admin.from("purchases").upsert(
        {
          user_id: userId,
          paddle_transaction_id: transactionId,
          product_id: item?.price?.product_id ?? "",
          price_id: priceId,
          amount_cents: amountCents,
          currency,
          environment: env,
        },
        { onConflict: "paddle_transaction_id" },
      ),
      { transactionId },
    );
    recorded += 1;

    if (tx?.subscription_id) continue; // renovação de assinatura: nada a liberar na loja

    const out = await applyStoreEffects({
      client: admin,
      userId,
      priceId,
      storeProductId: tx?.custom_data?.productId ?? null,
      transactionId,
      amountCents,
      currency,
      env,
    });
    if (out.applied === "coins") coins += 1;
    else if (out.applied === "pack") packs += 1;
    else skipped += 1;
  }

  return { checked: rows.length, recorded, coins, packs, skipped };
}

async function userOfSubscription(
  admin: any,
  subscriptionId: string | undefined,
  env: PaddleEnv,
): Promise<string | null> {
  if (!subscriptionId) return null;
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();
  return data?.user_id ?? null;
}
