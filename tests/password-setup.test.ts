import { expect, test } from "bun:test";
import { shouldOfferInitialPassword } from "../src/lib/password-setup-rules";
test("recognized passwordless accounts get the offer on home", () => {
  expect(shouldOfferInitialPassword("account-a", false, "/home")).toBe(true);
});
test("password offer never appears on the landing page", () => {
  expect(shouldOfferInitialPassword("account-a", false, "/")).toBe(false);
});
test("existing passwords never get an initial-password offer", () => {
  expect(shouldOfferInitialPassword("account-a", true, "/home")).toBe(false);
});
test("anonymous or unverified password status never gets an offer", () => {
  expect(shouldOfferInitialPassword(null, false, "/")).toBe(false);
  expect(shouldOfferInitialPassword("account-a", undefined, "/home")).toBe(false);
});
test("recovery retains its dedicated password form", () => {
  expect(shouldOfferInitialPassword("account-a", false, "/reset-password")).toBe(false);
});
