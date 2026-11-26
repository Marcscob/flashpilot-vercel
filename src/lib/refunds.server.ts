import { gatewayFetch, gatewayFetchAll, type PaddleEnv } from "@/lib/paddle.server";

type RefundAdjustmentItem = {
  transaction_item_id?: string | null;
  type?: string | null;
  amount?: string | number | null;
  totals?: {
    subtotal?: string | number | null;
    total?: string | number | null;
  } | null;
};

type RefundAdjustment = {
  id?: string | null;
  status?: string | null;
  transaction_id?: string | null;
  transactionId?: string | null;
  type?: string | null;
  items?: RefundAdjustmentItem[] | null;
  details?: { totals?: { subtotal?: string | number | null; total?: string | number | null } } | null;
  totals?: { subtotal?: string | number | null; total?: string | number | null } | null;
};

type PurchaseRow = {
  id: string;
  user_id: string;
  product_id: string;
  amount_cents: number | null;
  refunded_at: string | null;
};

function dbData<T>(label: string, result: { data: T; error: { message?: string } | null }): T {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message ?? "erro de banco"}`);
  }
  return result.data;
}

function numericAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstAmount(values: unknown[]): number | null {
  for (const value of values) {
    const amount = numericAmount(value);
    if (amount !== null) return amount;
  }
  return null;
}

function isPartialAdjustment(adjustment: RefundAdjustment | undefined): boolean {
  return String(adjustment?.type ?? "").toLowerCase() === "partial";
}

function meaningfulItems(adjustment: RefundAdjustment | undefined): RefundAdjustmentItem[] {
  return (adjustment?.items ?? []).filter(
    (item) => String(item.type ?? "").toLowerCase() !== "tax",
  );
}

function partialAdjustmentAmount(adjustment: RefundAdjustment | undefined): number | null {
  const items = meaningfulItems(adjustment);
  if (items.length) {
    const itemAmounts = items.map((item) =>
      firstAmount([item.amount, item.totals?.subtotal, item.totals?.total]),
    );
    if (itemAmounts.every((amount): amount is number => amount !== null)) {
      return itemAmounts.reduce((sum, amount) => sum + amount, 0);
    }
  }

  const fromTotals = firstAmount([
    adjustment?.details?.totals?.subtotal,
    adjustment?.totals?.subtotal,
    adjustment?.details?.totals?.total,
    adjustment?.totals?.total,
  ]);
  if (fromTotals !== null) return fromTotals;

  if (!items.length) return 0;
  const amounts = items.map((item) =>
    firstAmount([item.amount, item.totals?.subtotal, item.totals?.total]),
  );
  if (amounts.every((amount): amount is number => amount !== null)) {
    return amounts.reduce((sum, amount) => sum + amount, 0);
  }
  return null;
}

async function fetchTransaction(env: PaddleEnv, transactionId: string): Promise<any> {
  const response = await gatewayFetch(env, `/transactions/${encodeURIComponent(transactionId)}`);
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.data) {
    throw new Error(`Falha ao consultar transação para mapear reembolso (${response.status})`);
  }
  return json.data;
}

/**
 * Resolves the affected catalog products for a partial adjustment. App-created
 * transactions normally contain one purchase, but mapping by transaction item
 * avoids revoking unrelated products when a transaction has multiple items.
 */
async function resolvePartialPurchasePlan(
  admin: any,
  env: PaddleEnv,
  transactionId: string,
  adjustment: RefundAdjustment,
  purchases: PurchaseRow[],
): Promise<Array<{ purchase: PurchaseRow; amount: number }>> {
  const items = meaningfulItems(adjustment);
  if (!items.length) return [];
  // Coin-only purchases do not create user_purchases rows. Their partial
  // refund is handled by reverseProportionalCoins using the payment total.
  if (!purchases.length) return [];

  if (purchases.length === 1) {
    const amount = partialAdjustmentAmount(adjustment);
    if (amount !== null) {
      return [{ purchase: purchases[0]!, amount: Math.max(0, Math.round(amount)) }];
    }
    if (items.every((item) => String(item.type ?? "").toLowerCase() === "full")) {
      return [{ purchase: purchases[0]!, amount: purchases[0]!.amount_cents ?? 0 }];
    }
    throw new Error("Reembolso parcial sem valor identificável para a compra");
  }

  const transaction = await fetchTransaction(env, transactionId);
  const customProductId =
    typeof transaction?.custom_data?.productId === "string"
      ? transaction.custom_data.productId
      : null;
  const purchaseByProduct = new Map(purchases.map((purchase) => [purchase.product_id, purchase]));
  const productByTransactionItem = new Map<string, string>();

  if (!customProductId) {
    const transactionItems = Array.isArray(transaction?.items) ? transaction.items : [];
    const itemById = new Map<string, string>(
      transactionItems
        .filter((item: any) => item?.id && item?.price?.id)
        .map((item: any) => [String(item.id), String(item.price.id)]),
    );
    const priceIds = [...new Set(
      items
        .map((item) => item.transaction_item_id)
        .filter((id): id is string => !!id)
        .map((id) => itemById.get(id))
        .filter((id): id is string => !!id),
    )];
    if (priceIds.length) {
      const products = dbData(
        "mapear itens do reembolso",
        await admin
          .from("store_products")
          .select("id, paddle_price_id")
          .in("paddle_price_id", priceIds),
      ) as Array<{ id: string; paddle_price_id: string }>;
      const productByPrice = new Map(products.map((product) => [product.paddle_price_id, product.id]));
      for (const item of items) {
        const transactionItemId = item.transaction_item_id;
        const priceId = transactionItemId ? itemById.get(transactionItemId) : undefined;
        const productId = priceId ? productByPrice.get(priceId) : undefined;
        if (transactionItemId && productId) productByTransactionItem.set(transactionItemId, productId);
      }
    }
  }

  const amounts = new Map<string, number>();
  for (const item of items) {
    const productId =
      customProductId ??
      (item.transaction_item_id ? productByTransactionItem.get(item.transaction_item_id) : null);
    if (!productId) {
      throw new Error("Não foi possível identificar o produto do reembolso parcial");
    }
    const purchase = purchaseByProduct.get(productId);
    if (!purchase) {
      throw new Error("O produto do reembolso não pertence à transação registrada");
    }

    const itemType = String(item.type ?? "").toLowerCase();
    const amount =
      itemType === "full"
        ? purchase.amount_cents
        : firstAmount([item.amount, item.totals?.subtotal, item.totals?.total]);
    if (amount === null || amount === undefined) {
      throw new Error("Item do reembolso parcial sem valor identificável");
    }
    amounts.set(productId, (amounts.get(productId) ?? 0) + Math.max(0, Math.round(amount)));
  }

  return [...amounts].map(([productId, amount]) => ({
    purchase: purchaseByProduct.get(productId)!,
    amount,
  }));
}

/**
 * Reembolso também apaga a cópia entregue ao aluno: sem isso, o conteúdo
 * comprado continuaria disponível na conta dele depois do estorno.
 */
async function removeDeliveredCopy(admin: any, userId: string, productId: string) {
  const grants = dbData(
    "consultar matérias entregues",
    await admin
      .from("subject_grants")
      .select("id, copy_subject_id, source_subject_id")
      .eq("user_id", userId)
      .eq("product_id", productId),
  ) as Array<{ id: string; copy_subject_id: string | null; source_subject_id: string | null }>;

  // Também remove eventuais cópias extras da mesma matéria oficial.
  for (const grant of grants) {
    if (!grant.source_subject_id) continue;
    dbData(
      "remover cópias extras da matéria reembolsada",
      await admin
        .from("subjects")
        .delete()
        .eq("user_id", userId)
        .eq("source_id", grant.source_subject_id)
        .neq("id", grant.copy_subject_id ?? "00000000-0000-0000-0000-000000000000"),
    );
  }

  for (const grant of grants) {
    const copyId = grant.copy_subject_id;
    if (!copyId) continue;

    const categories = dbData(
      "consultar categorias da matéria reembolsada",
      await admin
        .from("note_categories")
        .select("id")
        .eq("user_id", userId)
        .eq("subject_id", copyId),
    ) as Array<{ id: string }>;
    const categoryIds = categories.map((category) => category.id);
    if (categoryIds.length) {
      dbData(
        "remover anotações da matéria reembolsada",
        await admin.from("notes").delete().in("category_id", categoryIds).not("source_id", "is", null),
      );
      dbData(
        "remover categorias da matéria reembolsada",
        await admin.from("note_categories").delete().in("id", categoryIds),
      );
    }

    dbData(
      "remover cópia da matéria reembolsada",
      await admin.from("subjects").delete().eq("id", copyId).eq("user_id", userId),
    );
    dbData(
      "limpar referência da matéria reembolsada",
      await admin.from("subject_grants").update({ copy_subject_id: null }).eq("id", grant.id),
    );
  }
}

/**
 * Reembolso: aplica o valor do ajuste, revoga uma compra apenas quando o
 * acumulado chega a 100% e estorna FlashCoins proporcionalmente.
 */
export async function revokeForRefund(
  admin: any,
  args: {
    transactionId: string;
    adjustmentId: string;
    env: PaddleEnv;
    adjustment?: RefundAdjustment;
  },
): Promise<{ packsRevoked: number; coinsReversed: number }> {
  const adjustment = args.adjustment;
  const partial = isPartialAdjustment(adjustment);
  const purchases = dbData(
    "consultar compras para reembolso",
    await admin
      .from("user_purchases")
      .select("id, user_id, product_id, amount_cents, refunded_at")
      .eq("paddle_transaction_id", args.transactionId)
      .eq("environment", args.env),
  ) as PurchaseRow[];
  const payment = dbData(
    "consultar pagamento para reembolso",
    await admin
      .from("purchases")
      .select("user_id, amount_cents")
      .eq("paddle_transaction_id", args.transactionId)
      .eq("environment", args.env)
      .maybeSingle(),
  ) as { user_id: string; amount_cents: number | null } | null;

  const plan = partial
    ? await resolvePartialPurchasePlan(admin, args.env, args.transactionId, adjustment!, purchases)
    : purchases.map((purchase) => ({
        purchase,
        amount: purchase.amount_cents ?? 0,
      }));

  let packsRevoked = 0;
  for (const entry of plan) {
    const purchase = entry.purchase;
    let fullyRefunded = !!purchase.refunded_at;
    let newlyApplied = false;

    if (!fullyRefunded) {
      const result = dbData(
        "registrar valor reembolsado",
        await admin.rpc("apply_user_purchase_refund", {
          p_user_purchase_id: purchase.id,
          p_adjustment_id: args.adjustmentId,
          p_amount_cents: entry.amount,
          p_full_refund: !partial,
        }),
      ) as Array<{
        already_applied: boolean;
        fully_refunded: boolean;
      }>;
      const row = result[0];
      if (!row) throw new Error("A alocação de reembolso não retornou resultado");
      fullyRefunded = row.fully_refunded;
      newlyApplied = !row.already_applied;
    }

    if (!fullyRefunded) continue;

    dbData(
      "revogar acesso da matéria reembolsada",
      await admin
        .from("subject_grants")
        .update({ expires_at: new Date().toISOString() })
        .eq("user_id", purchase.user_id)
        .eq("product_id", purchase.product_id),
    );
    await removeDeliveredCopy(admin, purchase.user_id, purchase.product_id);
    if (newlyApplied) packsRevoked += 1;
  }

  const credits = dbData(
    "consultar FlashCoins da compra reembolsada",
    await admin
      .from("flashcoin_ledger")
      .select("user_id, amount")
      .eq("paddle_transaction_id", args.transactionId)
      .gt("amount", 0),
  ) as Array<{ user_id: string; amount: number }>;
  const coinsReversed = await reverseProportionalCoins(admin, {
    transactionId: args.transactionId,
    adjustmentId: args.adjustmentId,
    adjustment,
    partial,
    purchases,
    plan,
    payment,
    credits,
  });

  return { packsRevoked, coinsReversed };
}

async function reverseProportionalCoins(
  admin: any,
  args: {
    transactionId: string;
    adjustmentId: string;
    adjustment?: RefundAdjustment;
    partial: boolean;
    purchases: PurchaseRow[];
    plan: Array<{ purchase: PurchaseRow; amount: number }>;
    payment: { user_id: string; amount_cents: number | null } | null;
    credits: Array<{ user_id: string; amount: number }>;
  },
): Promise<number> {
  if (!args.credits.length) return 0;
  if (args.partial && meaningfulItems(args.adjustment).length === 0) return 0;

  const users = new Set(args.credits.map((credit) => credit.user_id));
  if (users.size !== 1) {
    throw new Error("A transação possui créditos de usuários diferentes");
  }

  const originalCoins = args.credits.reduce((sum, credit) => sum + Math.max(0, Number(credit.amount) || 0), 0);
  if (originalCoins <= 0) return 0;

  const previousRefunds = dbData(
    "consultar estornos anteriores de FlashCoins",
    await admin
      .from("flashcoin_ledger")
      .select("amount")
      .eq("paddle_transaction_id", args.transactionId)
      .eq("reason", "refund")
      .lt("amount", 0),
  ) as Array<{ amount: number }>;
  const alreadyReversed = previousRefunds.reduce(
    (sum, entry) => sum + Math.max(0, -(Number(entry.amount) || 0)),
    0,
  );

  let ratio = 1;
  if (args.partial) {
    const originalAmount =
      numericAmount(args.payment?.amount_cents) ??
      args.purchases.reduce((sum, purchase) => sum + Math.max(0, purchase.amount_cents ?? 0), 0);
    const refundedAmount =
      args.plan.reduce((sum, entry) => sum + entry.amount, 0) ||
      partialAdjustmentAmount(args.adjustment);
    if (refundedAmount === null || refundedAmount <= 0) return 0;
    if (originalAmount <= 0) {
      throw new Error("Não foi possível calcular a proporção do reembolso de FlashCoins");
    }
    ratio = Math.min(1, Math.max(0, refundedAmount / originalAmount));
  }

  const target = Math.min(originalCoins, Math.round(originalCoins * ratio));
  const toReverse = Math.max(0, Math.min(originalCoins - alreadyReversed, target - alreadyReversed));
  if (toReverse <= 0) return 0;

  const { error } = await admin.rpc("apply_flashcoins", {
    p_user_id: args.credits[0]!.user_id,
    p_amount: -toReverse,
    p_reason: "refund",
    p_action_id: null,
    p_transaction_id: args.transactionId,
    p_adjustment_id: args.adjustmentId,
  });
  if (error) throw new Error(`Falha ao estornar FlashCoins: ${error.message}`);
  return toReverse;
}

/** Lê os reembolsos aprovados no provedor e aplica os que ainda não foram aplicados. */
export async function reconcileRefundsFromProvider(
  admin: any,
  env: PaddleEnv,
): Promise<{ checked: number; packsRevoked: number; coinsReversed: number }> {
  const rows = await gatewayFetchAll<RefundAdjustment>(
    env,
    "/adjustments?per_page=50&action=refund",
  );

  let packsRevoked = 0;
  let coinsReversed = 0;
  for (const adjustment of rows) {
    const status = String(adjustment?.status ?? "");
    if (status !== "approved") continue;
    const transactionId = String(adjustment.transaction_id ?? adjustment.transactionId ?? "");
    const adjustmentId = String(adjustment.id ?? "");
    if (!transactionId || !adjustmentId) continue;
    const out = await revokeForRefund(admin, {
      transactionId,
      adjustmentId,
      env,
      adjustment,
    });
    packsRevoked += out.packsRevoked;
    coinsReversed += out.coinsReversed;
  }
  return { checked: rows.length, packsRevoked, coinsReversed };
}
