import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const finalizeLandingHandoffFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { finalizeLandingHandoffs } = await import("./landing-handoff.server");
    return finalizeLandingHandoffs(context.userId);
  });

export const completeLandingMaterialsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        handoffId: z.string().uuid(),
        phase: z.enum(["start", "finish"]).default("finish"),
        done: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { recordLandingMaterialsAttempt } = await import("./landing-handoff.server");
    await recordLandingMaterialsAttempt(context.userId, data.handoffId, data.phase, data.done);
    return { ok: true as const };
  });

export const importLandingCardVideoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cardId: z.string().uuid(),
        lang: z.string().trim().min(2).max(40),
        scenes: z.array(z.unknown()).min(1).max(40),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { importLandingCardVideo } = await import("./landing-handoff.server");
    return importLandingCardVideo(context.userId, data.cardId, data.lang, data.scenes);
  });
