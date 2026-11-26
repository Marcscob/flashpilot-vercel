import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

declare global {
  interface Window {
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

/** Ouvintes avisados quando o checkout falha (ex.: cobrança real ainda não liberada). */
type CheckoutErrorListener = (detail?: unknown) => void;
const checkoutErrorListeners = new Set<CheckoutErrorListener>();

export function onPaddleCheckoutError(fn: CheckoutErrorListener): () => void {
  checkoutErrorListeners.add(fn);
  return () => {
    checkoutErrorListeners.delete(fn);
  };
}

function emitCheckoutError(detail?: unknown) {
  checkoutErrorListeners.forEach((fn) => {
    try {
      fn(detail);
    } catch {
      /* ignora falhas de ouvintes */
    }
  });
}

/** Ouvintes avisados quando o cliente conclui o pagamento no checkout. */
const checkoutDoneListeners = new Set<CheckoutErrorListener>();

export function onPaddleCheckoutCompleted(fn: CheckoutErrorListener): () => void {
  checkoutDoneListeners.add(fn);
  return () => {
    checkoutDoneListeners.delete(fn);
  };
}

function emitCheckoutCompleted(detail?: unknown) {
  checkoutDoneListeners.forEach((fn) => {
    try {
      fn(detail);
    } catch {
      /* ignora falhas de ouvintes */
    }
  });
}

let paddleInitialized = false;

export async function initializePaddle() {
  if (paddleInitialized) return;
  if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      const paddleJsEnvironment = getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      window.Paddle.Environment.set(paddleJsEnvironment);
      window.Paddle.Initialize({
        token: clientToken,
        eventCallback: (event: any) => {
          const name = String(event?.name ?? "");
          if (name === "checkout.error" || name === "checkout.failed" || name === "checkout.warning") {
            emitCheckoutError(event);
          } else if (name === "checkout.completed") {
            emitCheckoutCompleted(event);
          }
        },
      });
      paddleInitialized = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  const environment = getPaddleEnvironment();
  return resolvePaddlePrice({ data: { priceId, environment } });
}
