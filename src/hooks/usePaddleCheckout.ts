import { useEffect, useState } from "react";
import { toast } from "sonner";
import { initializePaddle, getPaddlePriceId, getPaddleEnvironment, onPaddleCheckoutError } from "@/lib/paddle";
import { useT } from "@/lib/i18n";

export function usePaddleCheckout() {
  const t = useT().checkout;
  const [loading, setLoading] = useState(false);
  /** Fica verdadeiro quando o pagamento não pôde ser aberto/concluído. */
  const [checkoutBlocked, setCheckoutBlocked] = useState(false);

  useEffect(() => {
    return onPaddleCheckoutError(() => {
      setCheckoutBlocked(true);
      toast.error(getPaddleEnvironment() === "live" ? t.pendingApproval : t.genericFail);
    });
  }, [t]);

  const openCheckout = async (options: {
    priceId?: string;
    /** Cobrança criada no servidor com nome próprio (aparece na fatura). */
    transactionId?: string;
    quantity?: number;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const items = options.transactionId
        ? undefined
        : [{ priceId: await getPaddlePriceId(options.priceId!), quantity: options.quantity ?? 1 }];

      window.Paddle.Checkout.open({
        transactionId: options.transactionId,
        items,
        customer: options.transactionId || !options.customerEmail ? undefined : { email: options.customerEmail },
        customData: options.transactionId ? undefined : options.customData,
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/home?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (e) {
      console.error("checkout open failed", e);
      setCheckoutBlocked(true);
      toast.error(getPaddleEnvironment() === "live" ? t.pendingApproval : t.genericFail);
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading, checkoutBlocked };
}
