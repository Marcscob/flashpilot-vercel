import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { isAppManagerIdentity } from "@/lib/app-manager";

export function useSubscription() {
  const environment = getPaddleEnvironment();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["subscription", environment],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return null;
      if (isAppManagerIdentity(userData.user)) {
        return { status: "active", current_period_end: null, price_id: "pro_2_yearly", product_id: "pro_2_plan", app_manager: true } as never;
      }
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("environment", environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      channel = supabase
        .channel(`subs-${uid}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["subscription", environment] }),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc, environment]);

  const sub = query.data;
  const now = Date.now();
  const endTs = sub?.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const isActive = !!sub && (
    (["active", "trialing", "past_due"].includes(sub.status) && (!endTs || endTs > now)) ||
    (sub.status === "canceled" && !!endTs && endTs > now)
  );

  return { subscription: sub, isActive, isPastDue: sub?.status === "past_due", loading: query.isLoading };
}
