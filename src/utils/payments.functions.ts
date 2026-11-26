import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";
import { mappedPaddlePriceId, catalogPriceIdOf } from "@/lib/payment-catalog";

const Input = z.object({
  // Só identificadores do próprio catálogo: nada de valor livre indo ao provedor.
  priceId: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._-]+$/),
  environment: z.enum(["sandbox", "live"]),
});

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  // Consulta ao provedor de pagamentos só para quem está autenticado no app.
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const mappedId = mappedPaddlePriceId(data.priceId, data.environment);
    if (mappedId) {
      const response = await gatewayFetch(data.environment, `/prices/${mappedId}`);
      if (!response.ok) throw new Error("Price not found");
      const result = await response.json();
      if (result.data?.status !== "active" || catalogPriceIdOf(result.data, data.environment) !== data.priceId) {
        throw new Error("Price unavailable");
      }
      return result.data.id as string;
    }
    const response = await gatewayFetch(
      data.environment as PaddleEnv,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    if (!response.ok) throw new Error("Price lookup failed");
    const result = await response.json();
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0].id as string;
  });
