import { z } from "zod";

/** Daily protection limits for the instant landing test (UTC days). */
export const LANDING_TEST_LIMITS = {
  perEmailPerDay: 3,
  globalPerDay: 300,
  cardsPerTest: 10,
  extrasPerVisitor: 3,
} as const;

/** Owner test accounts exempt from landing test limits. */
export const UNLIMITED_TEST_EMAILS = new Set(["marcscob@hotmail.com"]);

export const landingVisitorSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  lang: z.string().trim().min(2).max(12),
});

export type LandingExtraKind = "note" | "map" | "video";

export function canUseLandingExtra(used: number): boolean {
  return used < LANDING_TEST_LIMITS.extrasPerVisitor;
}
