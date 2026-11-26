import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAiBillingInfo } from "@/lib/ai-billing.functions";

export function useAiBillingInfo() {
  const load = useServerFn(getAiBillingInfo);
  return useQuery({
    queryKey: ["ai-billing"],
    queryFn: () => load({ data: undefined }),
    staleTime: 30_000,
  });
}
