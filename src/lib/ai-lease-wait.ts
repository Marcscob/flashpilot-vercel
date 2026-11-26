/**
 * Espera a operação PilotAI anterior da mesma conta terminar (ou sua trava
 * expirar) antes de iniciar uma nova, em vez de falhar na hora com
 * "Outra operação do PilotAI já está ativa". A trava dura no máximo ~60 s
 * (inclusive a quarentena após falha), então o prazo padrão cobre esse ciclo.
 */
export type LeaseAttempt = "acquired" | "busy";

export async function acquireLeaseWithWait(
  tryAcquire: () => Promise<LeaseAttempt>,
  options: {
    maxWaitMs?: number;
    intervalMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<boolean> {
  const maxWaitMs = options.maxWaitMs ?? 75_000;
  const intervalMs = options.intervalMs ?? 1_500;
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = now() + maxWaitMs;
  for (;;) {
    if ((await tryAcquire()) === "acquired") return true;
    const remaining = deadline - now();
    if (remaining <= 0) return false;
    await sleep(Math.min(intervalMs, remaining));
  }
}

/** Só o conflito de "outra operação ativa" vale esperar; outros 55P03 são definitivos. */
export function isLeaseBusyError(error: { code?: string; message?: string } | null): boolean {
  return !!error && error.code === "55P03" && /already active/i.test(error.message ?? "");
}
