import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Records that a feature fell back from a Gemini model; never throws. */
export async function logAiFallback(
  feature: string,
  failedModel: string,
  fallbackModel: string,
  reason: string | number | null,
): Promise<void> {
  try {
    await (
      supabaseAdmin as unknown as {
        from: (table: string) => { insert: (row: Record<string, unknown>) => Promise<unknown> };
      }
    )
      .from("ai_fallback_log")
      .insert({
        feature,
        failed_model: failedModel,
        fallback_model: fallbackModel,
        reason: reason == null ? null : String(reason).slice(0, 200),
      });
  } catch {
    // Logging must never break the user request.
  }
}
