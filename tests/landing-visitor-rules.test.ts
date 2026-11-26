import { describe, expect, it } from "vitest";
import { LANDING_TEST_LIMITS, canUseLandingExtra, landingVisitorSchema } from "../src/lib/landing-visitor-rules";

describe("landing visitor rules", () => {
  it("allows up to 3 notes/maps/videos per visitor", () => {
    expect(canUseLandingExtra(2)).toBe(true);
    expect(canUseLandingExtra(3)).toBe(false);
  });
  it("enforces test limits", () => {
    expect(LANDING_TEST_LIMITS.perEmailPerDay).toBe(3);
    expect(LANDING_TEST_LIMITS.cardsPerTest).toBe(10);
    expect(LANDING_TEST_LIMITS.globalPerDay).toBe(300);
  });
  it("requires name and valid email", () => {
    expect(landingVisitorSchema.safeParse({ name: "", email: "a@b.co", lang: "pt" }).success).toBe(false);
    expect(landingVisitorSchema.safeParse({ name: "Ana", email: "x", lang: "pt" }).success).toBe(false);
    expect(landingVisitorSchema.parse({ name: "Ana", email: " A@B.CO ", lang: "pt" }).email).toBe("a@b.co");
  });
});

