import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "@/lib/app-manager";

export type AiFallbackRow = {
  id: string;
  createdAt: string;
  feature: string;
  failedModel: string;
  fallbackModel: string | null;
  reason: string | null;
};

/** Últimos acionamentos de fallback de IA. Só AppManager. */
export const adminAiFallbacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiFallbackRow[]> => {
    if (!isAppManagerIdentity(context.claims)) throw new Error("Área restrita ao AppManager.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (
      supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (
              c: string,
              o: { ascending: boolean },
            ) => {
              limit: (n: number) => Promise<{
                data: Array<{
                  id: string;
                  created_at: string;
                  feature: string;
                  failed_model: string;
                  fallback_model: string | null;
                  reason: string | null;
                }> | null;
              }>;
            };
          };
        };
      }
    )
      .from("ai_fallback_log")
      .select("id,created_at,feature,failed_model,fallback_model,reason")
      .order("created_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      feature: r.feature,
      failedModel: r.failed_model,
      fallbackModel: r.fallback_model,
      reason: r.reason,
    }));
  });
