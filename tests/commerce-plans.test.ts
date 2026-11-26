import { describe, expect, test } from "bun:test";
import { COMMERCE_PLANS, isCurrentCommercePlan, subscriptionPlanTier } from "../src/lib/commerce-plans";

describe("commerce plan rules", () => {
  test.each([
    ["pro_monthly", 499, 700, 150, 150],
    ["pro_yearly", 3985, 700, 150, 300],
    ["pro_2_monthly", 1199, 2200, 250, 400],
    ["pro_2_yearly", 7990, 2200, 250, 800],
  ])("%s keeps its USD price, monthly quota, batch cap and payment coin grant", (id, amount, cards, batch, coins) => {
    const plan = COMMERCE_PLANS.find((p) => p.priceId === id);
    expect(plan).toBeDefined();
    expect(plan?.amount).toBe(amount);
    expect(plan?.cards).toBe(cards);
    expect(plan?.batch).toBe(batch);
    expect(plan?.coins).toBe(coins);
  });

  test("active price highlights only the matching plan; expired subscriptions highlight none", () => {
    for (const price of COMMERCE_PLANS) {
      const sub = { price_id: price.priceId };
      expect(COMMERCE_PLANS.filter((p) => isCurrentCommercePlan(p, sub, true)).map((p) => p.priceId)).toEqual([price.priceId]);
      expect(COMMERCE_PLANS.some((p) => isCurrentCommercePlan(p, sub, false))).toBe(false);
    }
  });

  test("Pro 2 is recognized by either its product or either billing price", () => {
    expect(subscriptionPlanTier({ product_id: "pro_2" })).toBe("pro2");
    expect(subscriptionPlanTier({ price_id: "pro_2_monthly" })).toBe("pro2");
    expect(subscriptionPlanTier({ price_id: "pro_2_yearly" })).toBe("pro2");
    expect(subscriptionPlanTier({ price_id: "pro_monthly" })).toBe("pro");
  });
});