import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ lang: z.string().max(35).optional() });

const SITE_NAME = "FlashPilot";
const SITE_URL = "https://flashpilot.net";

/**
 * Quem entra por um provedor social (Google) chega com o e-mail já verificado,
 * então a autenticação não dispara o e-mail de confirmação de cadastro. Este
 * envio cobre esses alunos: uma única mensagem de boas-vindas, no idioma do
 * aluno, marcada no perfil para nunca repetir.
 */
export const sendWelcomeEmailIfNeeded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const [{ supabaseAdmin }, { isProAiUser }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/ai-quota.server"),
    ]);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("welcome_email_sent_at, ui_lang")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.welcome_email_sent_at) return { sent: false as const, reason: "already_sent" };

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userError) throw userError;
    const user = userData.user;
    if (!user?.email) return { sent: false as const, reason: "no_email" };

    const providers = (user.identities ?? []).map((identity) => identity.provider);
    const markSent = async () => {
      await supabaseAdmin
        .from("profiles")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("user_id", context.userId);
    };

    // Cadastro por e-mail/senha já recebe o e-mail de confirmação com o mesmo
    // conteúdo: marcar como enviado evita mandar a mesma mensagem duas vezes.
    if (providers.length === 0 || providers.includes("email")) {
      await markSent();
      return { sent: false as const, reason: "confirmation_email_already_covers" };
    }

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
    if (
      isPro ||
      !grantResult.data ||
      trial?.blocked ||
      !Number.isFinite(trialEndTime) ||
      trialEndTime <= Date.now()
    ) {
      return { sent: false as const, reason: "welcome_kit_unavailable" };
    }

    const { resolveWelcomeLang } = await import("@/lib/email-templates/signup-i18n");
    const lang = resolveWelcomeLang(data.lang ?? profile?.ui_lang ?? (user.user_metadata?.["ui_lang"] as string | undefined));

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("welcome", user.email, {
      templateData: { siteName: SITE_NAME, siteUrl: SITE_URL, lang, trialEndsAt },
      idempotencyKey: `welcome-${context.userId}`,
    });

    await markSent();
    return { sent: result.sent };
  });
