import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { currentPeriodStart } from "./ai-credits";

/** Painel de créditos: saldo do mês e consumo de voz em nuvem do usuário. */
export const aiCreditStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { aiCreditStatusFor, chatCreditStatusFor } = await import("./ai-credits.server");
    const [status, chat] = await Promise.all([
      aiCreditStatusFor(context.supabase, context.userId, context.claims),
      chatCreditStatusFor(context.supabase, context.userId, context.claims),
    ]);

    const { count } = await context.supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("kind", "tts_cloud")
      .gte("created_at", currentPeriodStart().toISOString());

    // Fase 19 — a tela mostra também o saldo de conversação, em minutos aproximados.
    const { chatMinutesRemaining } = await import("./ai-credits");
    return {
      ...status,
      cloudGenerations: count ?? 0,
      chat: { ...chat, minutesRemaining: chatMinutesRemaining(chat.remaining) },
    };
  });
