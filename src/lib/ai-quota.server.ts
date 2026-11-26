import { acquireLeaseWithWait, isLeaseBusyError } from "./ai-lease-wait";
import type { Database } from "@/integrations/supabase/types";
import { getPaddleEnvironment } from "./paddle";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAppManagerIdentity } from "./app-manager";

export type AiQuotaResource =
  | "flashcards_job"
  | "flashcards_saved"
  | "mindmap"
  | "note_format"
  | "chat_turn"
  | "tts_standalone";

export class AiQuotaError extends Error {}
export class AiQuotaPreflightError extends Error {}
/** O período de teste de 15 (ou 20, com o presente de +5) dias acabou sem assinatura ativa. */
export class TrialExpiredError extends Error {}
export class AiGenerationLeaseError extends Error {}
export class AiGenerationLeaseLostError extends Error {}
export class AiGenerationLeaseAcquireError extends Error {
  constructor(readonly originalError: unknown) {
    super("Failed to acquire PilotAI generation lease.");
    this.name = "AiGenerationLeaseAcquireError";
  }
}
export class AiGenerationTimeoutError extends Error {}

export function throwIfAiGenerationAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw signal.reason instanceof AiGenerationTimeoutError
    ? signal.reason
    : new AiGenerationLeaseLostError("A operação terminou depois que sua trava do PilotAI foi perdida.");
}

type AiQuotaReservation = Awaited<ReturnType<typeof reserveAiQuota>>;

export type AiCoinActionId = "bulk" | "chat" | "mindmap" | "note_format";
export type AiBillingReceipt =
  | { source: "included"; chargedCoins: 0; balanceAfter: number }
  | { source: "flashcoins"; chargedCoins: number; balanceAfter: number }
  | {
      source: "flashcoins_reserved";
      chargedCoins: 0;
      reservedCoins: number;
      balanceAfter: number;
      holdId: string;
    };

type AiFeatureCoinHold = {
  holdId: string;
  isPro: boolean;
  coinsReserved: number;
  availableAfter: number;
};

async function reserveAiFeatureFlashcoins(input: {
  userId: string;
  actionId: string;
  jobId: string;
  resource: AiQuotaResource;
  coinActionId: AiCoinActionId;
}): Promise<AiFeatureCoinHold> {
  const { data, error } = await supabaseAdmin.rpc("reserve_ai_feature_flashcoins", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_job_id: input.jobId,
    p_resource: input.resource,
    p_cost_id: input.coinActionId,
    p_environment: getPaddleEnvironment(),
  });
  if (error) {
    if (error.code === "P0001") throw new AiQuotaError(error.message);
    throw error;
  }
  const row = data?.[0];
  if (!row) throw new Error("AI FlashCoin reservation returned no result");
  return {
    holdId: row.hold_id,
    isPro: row.is_pro,
    coinsReserved: row.coins_reserved,
    availableAfter: Number(row.available_after),
  };
}

export async function settleAiFeatureFlashcoins(input: {
  userId: string;
  holdId: string;
  success: boolean;
  uncertain?: boolean;
}): Promise<{ chargedCoins: number; balanceAfter: number; availableAfter: number }> {
  const { data, error } = await supabaseAdmin.rpc("settle_ai_feature_flashcoins", {
    p_user_id: input.userId,
    p_hold_id: input.holdId,
    p_success: input.success,
    p_uncertain: input.uncertain ?? false,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error("AI FlashCoin settlement returned no receipt");
  return {
    chargedCoins: row.charged_coins,
    balanceAfter: Number(row.balance_after),
    availableAfter: Number(row.available_after),
  };
}

async function renewAiFeatureCoinHold(userId: string, holdId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("renew_ai_feature_coin_hold", {
    p_user_id: userId,
    p_hold_id: holdId,
  });
  if (error) throw error;
}

async function hasActiveAiFeatureCoinHold(input: {
  userId: string;
  actionId: string;
  resource: AiQuotaResource;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc("has_active_ai_feature_coin_hold", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_resource: input.resource,
  });
  if (error) throw error;
  return data ?? null;
}

export async function assertAiQuotaOrFeatureCoinHold(input: {
  userId: string;
  actionId: string;
  resource: AiQuotaResource;
}): Promise<{ coinHoldId: string | null }> {
  try {
    await assertConsumedAiQuota(input);
    return { coinHoldId: null };
  } catch (quotaError) {
    const coinHoldId = await hasActiveAiFeatureCoinHold(input);
    if (!coinHoldId) throw quotaError;
    await renewAiFeatureCoinHold(input.userId, coinHoldId);
    return { coinHoldId };
  }
}

export async function getAvailableFlashcoins(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("get_available_flashcoins", {
    p_user_id: userId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export type AiPlanTier = "pro2" | "pro" | "free";

const PRO2_PRICE_IDS = new Set(["pro_2_monthly", "pro_2_yearly"]);

function isPro2Subscription(subscription: {
  price_id: string;
  product_id: string;
}): boolean {
  return PRO2_PRICE_IDS.has(subscription.price_id) || subscription.product_id === "pro_2";
}

/**
 * Retorna o nível do plano de IA do usuário: "pro2" (FlashPilot Pro 2),
 * "pro" (Pro padrão) ou "free". AppManager conta como "pro2" (acesso total).
 */
export async function getAiPlanTier(
  supabase: import("@supabase/supabase-js").SupabaseClient<Database>,
  userId: string,
  claims: unknown,
): Promise<AiPlanTier> {
  if (isAppManagerIdentity(claims)) return "pro2";
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, price_id, product_id, current_period_start, current_period_end")
    .eq("user_id", userId)
    .eq("environment", getPaddleEnvironment())
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  const now = Date.now();
  let tier: AiPlanTier = "free";
  for (const subscription of data ?? []) {
    const start = subscription.current_period_start
      ? Date.parse(subscription.current_period_start)
      : NaN;
    const end = subscription.current_period_end ? Date.parse(subscription.current_period_end) : NaN;
    const active =
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start <= now &&
      end > now &&
      ["active", "trialing", "past_due", "canceled"].includes(subscription.status);
    if (!active) continue;
    if (isPro2Subscription(subscription)) return "pro2";
    tier = "pro";
  }
  return tier;
}

export async function isProAiUser(
  supabase: import("@supabase/supabase-js").SupabaseClient<Database>,
  userId: string,
  claims: unknown,
): Promise<boolean> {
  return (await getAiPlanTier(supabase, userId, claims)) !== "free";
}

export async function reserveAiQuota(input: {
  userId: string;
  actionId: string;
  jobId: string;
  resource: AiQuotaResource;
  units: number;
}): Promise<{
  reservationId: string;
  isPro: boolean;
  periodStart: string;
  periodEnd: string;
  remaining: number;
  wasExisting: boolean;
}> {
  if (!Number.isSafeInteger(input.units) || input.units < 1) {
    throw new Error("Invalid PilotAI quota amount");
  }

  const { data, error } = await supabaseAdmin.rpc("reserve_ai_quota", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_job_id: input.jobId,
    p_resource: input.resource,
    p_units: input.units,
    p_environment: getPaddleEnvironment(),
  });
  if (error) {
    if (error.code === "P0001") throw new AiQuotaError(error.message);
    if (error.code === "P0003") throw new TrialExpiredError(error.message);
    throw error;
  }
  const row = data?.[0];
  if (!row) throw new Error("PilotAI quota reservation returned no result");
  return {
    reservationId: row.reservation_id,
    isPro: row.is_pro,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    remaining: row.remaining_units,
    wasExisting: row.was_existing,
  };
}

export async function settleAiQuota(input: {
  reservationId: string;
  success: boolean;
  wasSent?: boolean;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("settle_ai_quota", {
    p_reservation_id: input.reservationId,
    p_success: input.success,
    p_was_sent: input.wasSent ?? true,
  });
  if (error) throw error;
}

export async function assertConsumedAiQuota(input: {
  userId: string;
  actionId: string;
  resource: AiQuotaResource;
}): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("has_ai_quota_action", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_resource: input.resource,
  });
  if (error) throw error;
  if (!data) throw new AiQuotaError("A cota necessária para esta operação não foi consumida.");
}

export async function authorizeAiNoteFormatPart(input: {
  userId: string;
  actionId: string;
  partIndex: number;
  totalParts: number;
  totalChars: number;
  chunkChars: number;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("authorize_ai_note_format_part", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_part_index: input.partIndex,
    p_total_parts: input.totalParts,
    p_total_chars: input.totalChars,
    p_chunk_chars: input.chunkChars,
  });
  if (error) throw error;
  if (typeof data !== "boolean") {
    throw new Error("Note format part authorization returned no result");
  }
  return data;
}

export async function completeAiNoteFormatPart(input: {
  userId: string;
  actionId: string;
  partIndex: number;
  chunkChars: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("complete_ai_note_format_part", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_part_index: input.partIndex,
    p_chunk_chars: input.chunkChars,
  });
  if (error) throw error;
}

async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function authorizeAiChatTts(input: {
  userId: string;
  actionId: string;
  text: string;
}): Promise<void> {
  if (!input.text) return;
  const { error } = await supabaseAdmin.rpc("authorize_ai_chat_tts", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_response_hash: await hashText(input.text),
  });
  if (error) throw error;
}

/**
 * Reivindica atomicamente uma tentativa de síntese do TTS do tutor ANTES de
 * chamar o provider. Limita o número de chamadas caras que uma única
 * autorização de turno pode gerar, mesmo em retentativas sequenciais
 * (a trava de lease só impede execução concorrente).
 */
export async function claimAiChatTtsAttempt(input: {
  userId: string;
  actionId: string;
  text: string;
  maxAttempts?: number;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("claim_ai_chat_tts_attempt", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_response_hash: await hashText(input.text),
    p_max_attempts: input.maxAttempts ?? 3,
  });
  if (error) {
    if (error.code === "P0001") throw new AiQuotaError(error.message);
    throw error;
  }
}

export async function consumeAiChatTts(input: {
  userId: string;
  actionId: string;
  text: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("consume_ai_chat_tts", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_response_hash: await hashText(input.text),
  });
  if (error) {
    if (error.code === "P0001") throw new AiQuotaError(error.message);
    throw error;
  }
}

export async function runWithAiGenerationLease<T>(
  input: { userId: string; actionId: string },
  operation: (signal: AbortSignal, leaseId: string) => Promise<T>,
  onAbort?: (reason: unknown) => Promise<void>,
): Promise<T> {
  const leaseId = crypto.randomUUID();
  // Se outra operação da conta ainda está rodando, ela termina nos bastidores
  // e esta aguarda a vez, em vez de devolver erro ao aluno.
  let fatalError: { code?: string; message?: string } | null = null;
  const acquired = await acquireLeaseWithWait(async () => {
    const { error } = await supabaseAdmin.rpc("acquire_ai_generation_lease", {
      p_user_id: input.userId,
      p_action_id: input.actionId,
      p_lease_id: leaseId,
    });
    if (!error) return "acquired";
    if (isLeaseBusyError(error)) return "busy";
    fatalError = error;
    return "acquired";
  });
  if (fatalError) {
    const acquireError = fatalError as { code?: string; message?: string };
    if (acquireError.code === "55P03") {
      throw new AiGenerationLeaseError(
        "Outra operação do PilotAI já está ativa nesta conta. Tente novamente em instantes.",
      );
    }
    throw new AiGenerationLeaseAcquireError(acquireError);
  }
  if (!acquired) {
    throw new AiGenerationLeaseError(
      "Outra operação do PilotAI já está ativa nesta conta. Tente novamente em instantes.",
    );
  }

  const controller = new AbortController();
  let rejectAborted!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAborted = reject;
  });
  const rejectOnAbort = () => {
    rejectAborted(
      controller.signal.reason instanceof Error
        ? controller.signal.reason
        : new AiGenerationLeaseLostError("A operação perdeu sua trava do PilotAI."),
    );
  };
  controller.signal.addEventListener("abort", rejectOnAbort, { once: true });
  let heartbeatError: unknown;
  let heartbeat = Promise.resolve();
  let quarantinePromise: Promise<void> | null = null;
  let quarantineError: unknown;
  let abortHandling: Promise<void> | null = null;
  let abortHandlingError: unknown;
  const handleAbort = () => {
    if (!onAbort || abortHandling) return;
    abortHandling = onAbort(controller.signal.reason).catch((error: unknown) => {
      abortHandlingError = error;
      console.error("Failed to settle PilotAI operation after its lease was aborted", error);
    });
  };
  const quarantineLease = () => {
    if (!quarantinePromise) {
      quarantinePromise = (async () => {
        const { error } = await supabaseAdmin.rpc("quarantine_ai_generation_lease", {
          p_user_id: input.userId,
          p_action_id: input.actionId,
          p_lease_id: leaseId,
        });
        if (error) throw error;
      })().catch((error: unknown) => {
        quarantineError = error;
        throw error;
      });
    }
    return quarantinePromise;
  };
  const timeout = setTimeout(() => {
    controller.abort(new AiGenerationTimeoutError("A operação excedeu o limite de 60 segundos."));
    void quarantineLease().catch((error: unknown) => {
      console.error("Failed to quarantine timed-out PilotAI generation lease", error);
    });
    handleAbort();
  }, 60_000);
  const heartbeatTimer = setInterval(() => {
    heartbeat = heartbeat
      .then(async () => {
        if (controller.signal.aborted) return;
        const { error } = await supabaseAdmin.rpc("renew_ai_generation_lease", {
          p_user_id: input.userId,
          p_action_id: input.actionId,
          p_lease_id: leaseId,
        });
        if (error) throw error;
      })
      .catch((error: unknown) => {
        heartbeatError = error;
        controller.abort(new AiGenerationLeaseLostError("A operação perdeu sua trava do PilotAI."));
        void quarantineLease().catch((quarantineFailure: unknown) => {
          console.error("Failed to quarantine PilotAI lease after heartbeat failure", quarantineFailure);
        });
        handleAbort();
      });
  }, 15_000);

  let hasError = false;
  let primaryError: unknown;
  let result!: T;
  try {
    result = await Promise.race([operation(controller.signal, leaseId), aborted]);
    if (heartbeatError) {
      throw new AggregateError(
        [heartbeatError],
        "A operação terminou, mas a renovação da trava do PilotAI falhou.",
      );
    }
    if (controller.signal.aborted) {
      throw controller.signal.reason instanceof AiGenerationTimeoutError
        ? controller.signal.reason
        : new AiGenerationLeaseLostError(
            "A operação terminou depois que sua trava do PilotAI foi perdida.",
          );
    }
  } catch (error) {
    hasError = true;
    primaryError =
      controller.signal.aborted && controller.signal.reason instanceof AiGenerationTimeoutError
        ? controller.signal.reason
        : error;
  } finally {
    clearInterval(heartbeatTimer);
    clearTimeout(timeout);
    controller.signal.removeEventListener("abort", rejectOnAbort);
    await heartbeat;
    if (heartbeatError && !hasError) {
      hasError = true;
      primaryError = new AggregateError(
        [heartbeatError],
        "A operação terminou, mas a renovação da trava do PilotAI falhou.",
      );
    }
    if (abortHandling) await abortHandling;
    if (abortHandlingError) {
      primaryError = hasError
        ? new AggregateError(
            [primaryError, abortHandlingError],
            "A operação foi abortada e sua quota não pôde ser reconciliada.",
          )
        : abortHandlingError;
      hasError = true;
    }
    const shouldQuarantine = hasError && !(primaryError instanceof AiQuotaPreflightError);
    let leaseEndError = quarantineError;
    if (shouldQuarantine) {
      try {
        await quarantineLease();
      } catch (error) {
        leaseEndError = error;
      }
    } else {
      const { error } = await supabaseAdmin.rpc("release_ai_generation_lease", {
        p_user_id: input.userId,
        p_action_id: input.actionId,
        p_lease_id: leaseId,
      });
      leaseEndError = error;
    }
    if (leaseEndError) {
      console.error(
        shouldQuarantine
          ? "Failed to quarantine PilotAI generation lease after an uncertain provider result"
          : "Failed to release PilotAI generation lease",
        leaseEndError,
      );
      primaryError = hasError
        ? new AggregateError(
            [primaryError, leaseEndError],
            "A operação do PilotAI falhou e a trava não foi encerrada.",
          )
        : leaseEndError;
      hasError = true;
    }
  }
  if (hasError) throw primaryError;
  return result;
}

export async function runWithAiQuota<T>(
  input: Parameters<typeof reserveAiQuota>[0] & {
    coinActionId?: AiCoinActionId;
    deferCoinSettlement?: boolean;
  },
  operation: (reservation: AiQuotaReservation, signal: AbortSignal, leaseId: string) => Promise<T>,
  onSettled?: (receipt: AiBillingReceipt) => void,
): Promise<T> {
  let reservation: AiQuotaReservation;
  try {
    reservation = await reserveAiQuota(input);
  } catch (quotaError) {
    const canUseCoins =
      !!input.coinActionId &&
      quotaError instanceof AiQuotaError &&
      /(?:Free|Pro) resource quota exhausted/i.test(quotaError.message);
    if (!canUseCoins || !input.coinActionId) throw quotaError;

    const hold = await reserveAiFeatureFlashcoins({
      ...input,
      coinActionId: input.coinActionId,
    });
    const coinReservation = {
      reservationId: hold.holdId,
      isPro: hold.isPro,
      periodStart: "",
      periodEnd: "",
      remaining: 0,
      wasExisting: false,
    };
    let result: T;
    try {
      result = await runWithAiGenerationLease(input, (signal, leaseId) =>
        operation(coinReservation, signal, leaseId),
      );
    } catch (operationError) {
      const uncertain = !(
        operationError instanceof AiQuotaPreflightError ||
        operationError instanceof AiGenerationLeaseError ||
        operationError instanceof AiGenerationLeaseAcquireError
      );
      try {
        await settleAiFeatureFlashcoins({
          userId: input.userId,
          holdId: hold.holdId,
          success: false,
          uncertain,
        });
      } catch (settlementError) {
        console.error(
          "Failed to settle AI FlashCoin hold after operation failure",
          settlementError,
        );
        throw new AggregateError(
          [operationError, settlementError],
          "A operação do PilotAI falhou e a reserva de FlashCoins não pôde ser reconciliada.",
        );
      }
      throw operationError;
    }

    if (input.deferCoinSettlement) {
      onSettled?.({
        source: "flashcoins_reserved",
        chargedCoins: 0,
        reservedCoins: hold.coinsReserved,
        balanceAfter: hold.availableAfter,
        holdId: hold.holdId,
      });
      return result;
    }

    try {
      const receipt = await settleAiFeatureFlashcoins({
        userId: input.userId,
        holdId: hold.holdId,
        success: true,
      });
      onSettled?.({
        source: "flashcoins",
        chargedCoins: receipt.chargedCoins,
        balanceAfter: receipt.availableAfter,
      });
    } catch (settlementError) {
      try {
        await settleAiFeatureFlashcoins({
          userId: input.userId,
          holdId: hold.holdId,
          success: false,
          uncertain: true,
        });
      } catch (uncertainError) {
        console.error(
          "Failed to preserve AI FlashCoin hold after settlement failure",
          uncertainError,
        );
        throw new AggregateError(
          [settlementError, uncertainError],
          "A operação foi concluída, mas o débito precisa ser reconciliado.",
        );
      }
      throw new Error("A operação foi concluída, mas o débito precisa ser reconciliado.", {
        cause: settlementError,
      });
    }
    return result;
  }

  if (reservation.wasExisting) {
    throw new AiQuotaError(
      "Esta operação já foi iniciada. Atualize o estado antes de tentar novamente.",
    );
  }

  let result: T;
  try {
    result = await runWithAiGenerationLease(
      input,
      async (signal, leaseId) => {
        let result: T;
        try {
          result = await operation(reservation, signal, leaseId);
        } catch (operationError) {
          try {
            await settleAiQuota({
              reservationId: reservation.reservationId,
              success: false,
              wasSent: signal.aborted || !(operationError instanceof AiQuotaPreflightError),
            });
          } catch (settlementError) {
            console.error("Failed to settle PilotAI quota after operation failure", settlementError);
            throw new AggregateError(
              [operationError, settlementError],
              "A operação do PilotAI falhou e a cota não pôde ser reconciliada.",
            );
          }
          throw operationError;
        }
        if (signal.aborted) {
          throw (
            signal.reason ??
            new AiGenerationLeaseLostError(
              "A operação terminou depois que sua trava do PilotAI foi perdida.",
            )
          );
        }
        await settleAiQuota({ reservationId: reservation.reservationId, success: true });
        return result;
      },
      async () => {
        await settleAiQuota({
          reservationId: reservation.reservationId,
          success: false,
          wasSent: true,
        });
      },
    );
  } catch (error) {
    if (error instanceof AiGenerationLeaseError || error instanceof AiGenerationLeaseAcquireError) {
      try {
        await settleAiQuota({
          reservationId: reservation.reservationId,
          success: false,
          wasSent: false,
        });
      } catch (settlementError) {
        console.error(
          "Failed to release PilotAI quota after generation lease rejection",
          settlementError,
        );
        throw new AggregateError(
          [error, settlementError],
          "A operação do PilotAI não foi iniciada e a cota não pôde ser liberada.",
        );
      }
      if (error instanceof AiGenerationLeaseAcquireError) {
        throw error.originalError;
      }
    }
    throw error;
  }
  onSettled?.({
    source: "included",
    chargedCoins: 0,
    balanceAfter: await getAvailableFlashcoins(input.userId),
  });
  return result;
}
