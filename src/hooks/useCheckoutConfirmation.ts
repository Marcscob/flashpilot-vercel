import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { onPaddleCheckoutCompleted, getPaddleEnvironment } from "@/lib/paddle";
import { purchaseSnapshot, confirmCheckout } from "@/lib/billing.functions";
import { useT } from "@/lib/i18n";

/** Consultas que dependem do que foi comprado. */
const KEYS = [
  ["store-catalog"],
  ["account-overview"],
  ["subject-grants"],
  ["subjects"],
  ["study-queue"],
  ["flashcoins"],
  ["ai-billing"],
  ["subscription"],
];

/**
 * Confirma o pagamento direto no provedor (pelo pagamento recém-concluído) e,
 * na falta desse dado, espera o aviso do provedor chegar ao banco. Nada é
 * liberado pelo app por conta própria: a confirmação é sempre do provedor.
 */
export function useCheckoutConfirmation() {
  const t = useT().checkout;
  const qc = useQueryClient();
  const snapshot = useServerFn(purchaseSnapshot);
  const confirm = useServerFn(confirmCheckout);
  const [waiting, setWaiting] = useState(false);
  const running = useRef(false);

  const start = useCallback(
    async (transactionId?: string | null) => {
      if (running.current) return;
      running.current = true;
      setWaiting(true);
      try {
        let confirmed = false;

        // 1) Caminho rápido: conferir o pagamento no provedor e aplicar na hora.
        if (transactionId) {
          for (let attempt = 0; attempt < 3 && !confirmed; attempt += 1) {
            try {
              const out = await confirm({
                data: { transactionId, environment: getPaddleEnvironment() },
              });
              if (out.ok) confirmed = true;
              else if (out.reason !== "pending") break;
            } catch {
              break;
            }
            if (!confirmed) await new Promise((r) => setTimeout(r, 2500));
          }
        }

        // 2) Retaguarda: esperar o aviso do provedor mudar o banco.
        if (!confirmed) {
          let before: Awaited<ReturnType<typeof snapshot>> | null = null;
          try {
            before = await snapshot({} as any);
          } catch {
            before = null;
          }
          const deadline = Date.now() + 30_000;
          while (Date.now() < deadline && !confirmed) {
            await new Promise((r) => setTimeout(r, 3000));
            try {
              const now = await snapshot({} as any);
              if (
                !before ||
                now.lastPurchaseAt !== before.lastPurchaseAt ||
                now.balance !== before.balance
              ) {
                confirmed = true;
              }
            } catch {
              /* tenta de novo */
            }
          }
        }

        for (const key of KEYS) qc.invalidateQueries({ queryKey: key });
        toast[confirmed ? "success" : "info"](confirmed ? t.confirmed : t.confirmSlow);
      } finally {
        running.current = false;
        setWaiting(false);
      }
    },
    [confirm, qc, snapshot, t],
  );

  // Pagamento concluído no overlay do provedor.
  useEffect(
    () =>
      onPaddleCheckoutCompleted((detail: any) => {
        const txId =
          detail?.data?.transaction_id ?? detail?.data?.transactionId ?? null;
        void start(typeof txId === "string" ? txId : null);
      }),
    [start],
  );

  // Retorno pela successUrl (?checkout=success).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") !== "success") return;
    const txId = url.searchParams.get("transaction_id") ?? url.searchParams.get("txn");
    url.searchParams.delete("checkout");
    window.history.replaceState({}, "", url.pathname + url.search);
    void start(txId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { waiting, waitingLabel: t.confirming };
}
