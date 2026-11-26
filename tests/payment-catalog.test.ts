import { describe, expect, test } from "bun:test";
import { catalogPriceIdOf, mappedPaddlePriceId, subscriptionCatalogIds, subscriptionCoinGrant, subscriberPlanCounts } from "../src/lib/payment-catalog";
import { COMMERCE_PLANS } from "../src/lib/commerce-plans";

describe("manual Pro 2 payment catalog", () => {
  test.each([
    ["pro_2_monthly", "pri_01m5q57x8kh72nj61mp83sz8ee", 400],
    ["pro_2_yearly", "pri_01m5q5d9t2w85yxhr2dh22ysgq", 800],
  ])("%s resolves checkout, null-metadata events and grants", (priceId, internalId, coins) => {
    expect(mappedPaddlePriceId(priceId, "live")).toBe(internalId);
    expect(catalogPriceIdOf({ id: internalId, import_meta: null }, "live")).toBe(priceId);
    expect(subscriptionCatalogIds({ price: { id: internalId, importMeta: null }, product: { id: "pro_01m5q4pmth05mzjjx7hbf8vsfb", importMeta: null } }, "live")).toEqual({ priceId, productId: "pro_2" });
    expect(subscriptionCoinGrant(priceId)).toBe(coins);
    expect(COMMERCE_PLANS.find((p) => p.priceId === priceId)?.cards).toBe(2200);
    expect(mappedPaddlePriceId(priceId, "sandbox")).toBeNull();
    expect(catalogPriceIdOf({ id: internalId }, "sandbox")).toBeNull();
  });

  test("existing imported plans remain recognized in both casing formats", () => {
    expect(subscriptionCatalogIds({ price: { importMeta: { externalId: "pro_monthly" } }, product: { importMeta: { externalId: "pro_plan" } } }, "sandbox")).toEqual({ priceId: "pro_monthly", productId: "pro_plan" });
    expect(subscriptionCatalogIds({ price: { import_meta: { external_id: "pro_yearly" } } }, "live")).toEqual({ priceId: "pro_yearly", productId: "pro_plan" });
    expect(subscriptionCoinGrant("pro_monthly")).toBe(150);
    expect(subscriptionCoinGrant("pro_yearly")).toBe(300);
    expect(subscriptionCatalogIds({ price: { id: "pri_unknown" } }, "live")).toBeNull();
  });

  test("Admin separates Pro and Pro 2 counts by environment and recognizes product-only rows", () => {
    expect(subscriberPlanCounts([
      { price_id: "pro_monthly", product_id: "pro", environment: "live" },
      { price_id: "pro_2_monthly", product_id: "wrong_old_product", environment: "live" },
      { price_id: "pro_2_yearly", product_id: "pro_2", environment: "sandbox" },
      { product_id: "pro_2", environment: "live" },
    ])).toEqual([
      { productId: "pro", count: 1, live: 1, sandbox: 0 },
      { productId: "pro_2", count: 3, live: 2, sandbox: 1 },
    ]);
  });
});