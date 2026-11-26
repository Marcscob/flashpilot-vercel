import { COMMERCE_PLANS } from "./commerce-plans";

type PaymentEnvironment = "sandbox" | "live";

// These manually-created prices were verified in live, not in sandbox.
const LIVE_PRO2_PRICES: Record<string, string> = {
  pro_2_monthly: "pri_01m5q57x8kh72nj61mp83sz8ee",
  pro_2_yearly: "pri_01m5q5d9t2w85yxhr2dh22ysgq",
};

export function mappedPaddlePriceId(priceId: string, env: PaymentEnvironment): string | null {
  return env === "live" ? LIVE_PRO2_PRICES[priceId] ?? null : null;
}

export function catalogPriceIdOf(price: any, env: PaymentEnvironment): string | null {
  if (env === "live") {
    const mapped = Object.entries(LIVE_PRO2_PRICES).find(([, id]) => id === price?.id);
    if (mapped) return mapped[0];
  }
  const external = price?.importMeta?.externalId ?? price?.import_meta?.external_id;
  return typeof external === "string" && external.trim() ? external.trim() : null;
}

export function subscriptionCatalogIds(item: any, env: PaymentEnvironment) {
  const priceId = catalogPriceIdOf(item?.price, env);
  const plan = COMMERCE_PLANS.find((p) => p.priceId === priceId);
  const externalProduct = item?.product?.importMeta?.externalId ?? item?.product?.import_meta?.external_id;
  const productId = plan?.tier === "pro2" ? "pro_2" : externalProduct || (plan ? "pro_plan" : null);
  return priceId && typeof productId === "string" && productId.trim()
    ? { priceId, productId: productId.trim() }
    : null;
}

export function subscriptionCoinGrant(priceId: string): number {
  return COMMERCE_PLANS.find((p) => p.priceId === priceId)?.coins ?? 0;
}

export function subscriberPlanCounts(rows: Array<{ price_id?: string | null; product_id?: string | null; environment: string }>) {
  return ["pro", "pro_2"].map((productId) => {
    const matches = rows.filter((s) => {
      const priceId = catalogPriceIdOf({ id: s.price_id, importMeta: { externalId: s.price_id } }, s.environment === "live" ? "live" : "sandbox");
      const plan = COMMERCE_PLANS.find((p) => p.priceId === priceId);
      const group = plan ? (plan.tier === "pro2" ? "pro_2" : "pro")
        : s.product_id === "pro_2" ? "pro_2"
        : s.product_id === "pro" || s.product_id === "pro_plan" ? "pro" : null;
      return group === productId;
    });
    return {
      productId,
      count: matches.length,
      live: matches.filter((s) => s.environment === "live").length,
      sandbox: matches.filter((s) => s.environment === "sandbox").length,
    };
  });
}