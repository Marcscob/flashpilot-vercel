import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "./app-manager";
import { GameCurationReviewSchema } from "./game-curation";
import { matchRoundSchema } from "./match-game";

function assertManager(claims: unknown) {
  if (!isAppManagerIdentity(claims)) throw new Error("Área restrita ao AppManager.");
}

export const listGameCuration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertManager(context.claims);
    const { data, error } = await context.supabase
      .from("community_game_curation")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Audita com o PilotAI os candidatos pendentes que ainda não foram auditados. */
export const prepareGameCuration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(20).default(10) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    assertManager(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditGameCandidate } = await import("./game-curation.server");
    const { data: pending, error } = await supabaseAdmin
      .from("community_game_curation")
      .select("id, title, language, subject, chapter, topic, rounds, version")
      .eq("status", "pending")
      .eq("audited", false)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    let prepared = 0;
    const errors: string[] = [];
    for (const row of pending ?? []) {
      try {
        const rounds = z.array(matchRoundSchema).parse(row.rounds);
        const verdict = await auditGameCandidate({ ...row, rounds }, AbortSignal.timeout(45_000));
        const { error: updateError } = await supabaseAdmin
          .from("community_game_curation")
          .update({
            eligible: verdict.eligible,
            risk: verdict.risk,
            audit_reason: verdict.reason,
            audited: true,
            subject: verdict.subject || row.subject,
            chapter: verdict.chapter || row.chapter,
            topic: verdict.topic || row.topic,
          })
          .eq("id", row.id)
          .eq("version", row.version)
          .eq("status", "pending");
        if (updateError) throw new Error(updateError.message);
        prepared++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Falha na auditoria.");
      }
    }
    return { prepared, errors };
  });

export const reviewGameCuration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => GameCurationReviewSchema.parse(data))
  .handler(async ({ context, data }) => {
    assertManager(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, version, decision, reviewNotes, rightsNotes, rightsConfirmed, ...draft } = data;
    const { data: officialDeckId, error } = await supabaseAdmin.rpc("review_game_curation", {
      p_id: id,
      p_version: version,
      p_reviewer: context.userId,
      p_decision: decision,
      p_draft: draft,
      p_notes: reviewNotes,
      p_rights: rightsNotes,
      p_confirmed: rightsConfirmed,
    });
    if (error) throw new Error(error.message);
    return { officialDeckId };
  });
