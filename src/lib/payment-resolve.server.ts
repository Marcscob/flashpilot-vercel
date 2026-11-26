import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";
import { catalogPriceIdOf } from "@/lib/payment-catalog";

/**
 * Descobre qual preço do catálogo foi pago.
 *
 * O aviso de pagamento do provedor não traz o identificador do nosso catálogo
 * (`import_meta.external_id`) e, nas cobranças com nome amigável na fatura, o
 * item é avulso. A resolução é feita em quatro níveis, do mais direto ao mais
 * indireto, e nunca termina em silêncio: quem chama decide o que fazer com null.
 */
export async function resolveCatalogPriceId(args: {
  admin: any;
  env: PaddleEnv;
  transactionId: string;
  item?: any;
  customData?: any;
}): Promise<string | null> {
  const fromItem = catalogPriceIdOf(args.item?.price, args.env);
  if (fromItem) return fromItem;

  const fromCustom = asId(args.customData?.priceId);
  if (fromCustom) return fromCustom;

  // A API devolve import_meta mesmo quando o aviso não traz.
  if (args.transactionId) {
    try {
      const res = await gatewayFetch(args.env, `/transactions/${args.transactionId}`);
      if (res.ok) {
        const json: any = await res.json();
        const tx = json?.data;
        const fromApi =
          catalogPriceIdOf(tx?.items?.[0]?.price, args.env) ?? asId(tx?.custom_data?.priceId);
        if (fromApi) return fromApi;
        const productFromApi = asId(tx?.custom_data?.productId);
        if (productFromApi) {
          const byProduct = await priceOfStoreProduct(args.admin, productFromApi);
          if (byProduct) return byProduct;
        }
      }
    } catch (e) {
      console.warn("[payments] falha ao consultar transação no provedor", {
        transactionId: args.transactionId,
        error: e instanceof Error ? e.message : e,
      });
    }
  }

  // Último nível: o produto da loja escolhido na compra sempre acompanha o checkout.
  const storeProductId = asId(args.customData?.productId);
  if (storeProductId) return priceOfStoreProduct(args.admin, storeProductId);
  return null;
}

function asId(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s : null;
}

async function priceOfStoreProduct(admin: any, storeProductId: string): Promise<string | null> {
  const { data } = await admin
    .from("store_products")
    .select("paddle_price_id")
    .eq("id", storeProductId)
    .maybeSingle();
  return asId((data as any)?.paddle_price_id);
}
