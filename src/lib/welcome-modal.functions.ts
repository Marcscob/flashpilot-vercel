import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Estado da tela de boas-vindas. Guardado no perfil (e não no navegador) para que
 * "não mostrar mais" valha em qualquer aparelho onde o aluno entrar.
 */
export const getWelcomeModalState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("welcome_modal_dismissed_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    const [{ supabaseAdmin }, { isProAiUser }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/ai-quota.server"),
    ]);
    const [trialResult, grantResult, isPro] = await Promise.all([
      supabaseAdmin.rpc("get_trial_status", { p_user_id: context.userId }),
      supabaseAdmin
        .from("ai_welcome_grants")
        .select("user_id")
        .eq("user_id", context.userId)
        .maybeSingle(),
      isProAiUser(context.supabase, context.userId, context.claims),
    ]);
    if (trialResult.error) throw trialResult.error;
    if (grantResult.error) throw grantResult.error;

    const trial = trialResult.data?.[0];
    const trialEndsAt = trial?.trial_ends_at ?? null;
    const trialEndTime = trialEndsAt ? Date.parse(trialEndsAt) : NaN;
    const hasActiveTrial =
      !trial?.blocked && Number.isFinite(trialEndTime) && trialEndTime > Date.now();

    return {
      dismissed:
        Boolean(data?.welcome_modal_dismissed_at) || !hasActiveTrial || isPro || !grantResult.data,
      trialEndsAt,
    };
  });

export const dismissWelcomeModal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ welcome_modal_dismissed_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
