import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  LANDING_TEST_LIMITS,
  UNLIMITED_TEST_EMAILS,
  landingVisitorSchema,
} from "./landing-visitor-rules";

export { UNLIMITED_TEST_EMAILS };

export type LandingReservation =
  | { ok: true; visitorId: string }
  | { ok: false; reason: "email_limit" | "global_limit"; visitorId: string };

/** Registers/updates the visitor and reserves one test within the daily limits. */
export async function reserveLandingTest(input: unknown): Promise<LandingReservation> {
  const v = landingVisitorSchema.parse(input);
  const { data, error } = await supabaseAdmin.rpc("reserve_landing_test", {
    _email: v.email,
    _name: v.name,
    _lang: v.lang,
    _per_email: UNLIMITED_TEST_EMAILS.has(v.email) ? 1_000_000 : LANDING_TEST_LIMITS.perEmailPerDay,
    _global: UNLIMITED_TEST_EMAILS.has(v.email) ? 1_000_000 : LANDING_TEST_LIMITS.globalPerDay,
  });
  if (error) throw new Error("landing_reserve_failed");
  const r = data as { ok: boolean; reason?: string; visitor_id: string };
  return r.ok
    ? { ok: true, visitorId: r.visitor_id }
    : { ok: false, reason: r.reason as "email_limit" | "global_limit", visitorId: r.visitor_id };
}

/**
 * Keeps one generated material (note, map or video script) with the registered
 * test so the account can import it without another AI call. Best effort: the
 * visitor already has the material on screen, so failures are only logged.
 */
export async function saveLandingGeneratedMaterial(input: {
  email: string;
  testId: string;
  ordinal: number;
  kind: "note" | "map" | "video";
  value: unknown;
}) {
  try {
    const email = input.email.trim().toLowerCase();
    const { data: visitor } = await supabaseAdmin
      .from("landing_visitors")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!visitor) return;
    const { data: handoff } = await supabaseAdmin
      .from("landing_visitor_handoffs")
      .select("id")
      .eq("visitor_id", visitor.id)
      .eq("test_id", input.testId)
      .maybeSingle();
    if (!handoff) return;
    const rpcClient = supabaseAdmin as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };
    const { error } = await rpcClient.rpc("merge_landing_generated_material", {
      _handoff_id: handoff.id,
      _ordinal: String(input.ordinal),
      _kind: input.kind,
      _value: input.value,
    });
    if (error) console.error("Landing generated material not saved", error.message);
  } catch (error) {
    console.error("Landing generated material not saved", error);
  }
}

/** Stores the generated cards of one test, preserving source order. */
export async function saveLandingVisitorCards(
  visitorId: string,
  testId: string,
  cards: { question: string; answer: string }[],
) {
  const rows = cards.slice(0, LANDING_TEST_LIMITS.cardsPerTest).map((c, i) => ({
    visitor_id: visitorId,
    test_id: testId,
    ordinal: i,
    question: c.question.slice(0, 2000),
    answer: c.answer.slice(0, 4000),
  }));
  if (!rows.length) return;
  const { error } = await supabaseAdmin.from("landing_visitor_cards").insert(rows);
  if (error) throw new Error("landing_cards_save_failed");
}
