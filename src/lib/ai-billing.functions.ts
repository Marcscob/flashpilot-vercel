import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "./app-manager";
import type { AiCoinActionId } from "./ai-quota.server";

const PRICE_IDS: AiCoinActionId[] = ["bulk", "chat", "mindmap", "note_format"];

export const getAiBillingInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: balance, error: balanceError }, { data: costs, error: costsError }] =
      await Promise.all([
        supabaseAdmin.rpc("get_available_flashcoins", { p_user_id: context.userId }),
        supabaseAdmin
          .from("ai_action_costs")
          .select("id, coins_cost, is_active")
          .in("id", PRICE_IDS),
      ]);
    if (balanceError) throw balanceError;
    if (costsError) throw costsError;

    const prices: Partial<Record<AiCoinActionId, number>> = {};
    for (const cost of costs ?? []) {
      if (!cost.is_active) continue;
      const amount = Number(cost.coins_cost);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error(`Invalid FlashCoin price configured for ${cost.id}.`);
      }
      prices[cost.id as AiCoinActionId] = amount;
    }
    const isOwner = isAppManagerIdentity(context.claims);
    return { balance: isOwner ? 999_999 : Number(balance ?? 0), prices, isOwner };
  });
