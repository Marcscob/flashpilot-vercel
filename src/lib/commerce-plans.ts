/** Browser-safe catalog shared by pricing and the store; amounts are USD cents. */
export const COMMERCE_PLANS = [
  { priceId: "pro_monthly", tier: "pro", annual: false, amount: 499, cards: 700, batch: 150, coins: 150, label: "monthly" },
  { priceId: "pro_yearly", tier: "pro", annual: true, amount: 3985, cards: 700, batch: 150, coins: 300, label: "yearly" },
  { priceId: "pro_2_monthly", tier: "pro2", annual: false, amount: 1199, cards: 2200, batch: 250, coins: 400, label: "monthly2" },
  { priceId: "pro_2_yearly", tier: "pro2", annual: true, amount: 7990, cards: 2200, batch: 250, coins: 800, label: "yearly2" },
] as const;

export type CommercePlan = (typeof COMMERCE_PLANS)[number];
export type CommercePriceId = CommercePlan["priceId"];

export function subscriptionPlanTier(subscription?: { price_id?: string | null; product_id?: string | null } | null) {
  return subscription?.product_id === "pro_2" || subscription?.price_id === "pro_2_monthly" || subscription?.price_id === "pro_2_yearly" ? "pro2" : "pro";
}

export function isCurrentCommercePlan(plan: CommercePlan, subscription: { price_id?: string | null; product_id?: string | null } | null | undefined, active: boolean) {
  return active && plan.priceId === subscription?.price_id;
}