import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrialStatus = {
  blocked: boolean;
  trialEndsAt: string | null;
  extensionGranted: boolean;
  flashcoinsBalance: number;
};

/** Status do período de teste de 15 (ou 20, com o presente de +5) dias do aluno. */
export const getTrialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrialStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_trial_status", {
      p_user_id: context.userId,
    });
    if (error) throw error;
    const row = data?.[0];
    const blocked = !!row?.blocked;

    if (blocked) {
      // Dispara o e-mail de fim de teste uma única vez (idempotência via
      // trial_blocked_email_sent_at), espelhando sendWelcomeEmailIfNeeded.
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("trial_blocked_email_sent_at")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!profile?.trial_blocked_email_sent_at) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
        const email = userData.user?.email;
        if (email) {
          try {
            const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
            await sendTemplateEmail("trial-ended", email, {
              idempotencyKey: `trial-ended-${context.userId}`,
            });
          } catch (emailError) {
            console.error("Failed to send trial-ended email", emailError);
          }
        }
        await supabaseAdmin
          .from("profiles")
          .update({ trial_blocked_email_sent_at: new Date().toISOString() })
          .eq("user_id", context.userId);
      }
    }

    const { data: bal } = await supabaseAdmin
      .from("profiles")
      .select("flashcoins_balance")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      blocked,
      trialEndsAt: row?.trial_ends_at ?? null,
      extensionGranted: !!row?.extension_granted,
      flashcoinsBalance: Number(bal?.flashcoins_balance ?? 0),
    };
  });

/**
 * Concede o presente de +5 dias uma única vez. Chamadas repetidas são no-op
 * (o campo trial_extension_granted_at nunca é preenchido duas vezes).
 */
export const claimTrialExtension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ trialEndsAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("grant_trial_extension", {
      p_user_id: context.userId,
    });
    if (error) throw error;
    const row = data?.[0];
    if (!row) throw new Error("Trial extension request returned no result.");
    return { trialEndsAt: row.trial_ends_at };
  });
