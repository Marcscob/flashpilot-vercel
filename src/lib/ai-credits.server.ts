/**
 * Fase 20 — verificação de assinatura e crédito ANTES de qualquer chamada
 * externa do PilotAI. Server-only: nunca confie no frontend para liberar consumo.
 */
import {
  NO_CREDITS_MESSAGE,
  NO_SUBSCRIPTION_MESSAGE,
  TTS_MONTHLY_CHAR_LIMIT,
  currentPeriodEnd,
  currentPeriodStart,
  type AiCreditStatus,
  type AiUsageKind,
} from "./ai-credits";
import { isAppManagerIdentity } from "./app-manager";
import { getPaddleEnvironment } from "./paddle";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

function ownerFromClaims(claims: unknown): boolean {
  return isAppManagerIdentity(claims);
}

type SubscriptionPeriod = {
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
};

async function activeSubscription(
  supabase: Client,
  userId: string,
): Promise<SubscriptionPeriod | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_start, current_period_end")
    .eq("user_id", userId)
    .eq("environment", getPaddleEnvironment())
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;

  const now = Date.now();
  return (data ?? []).find((s: SubscriptionPeriod) => {
    const end = s.current_period_end ? new Date(s.current_period_end).getTime() : null;
    if (["active", "trialing", "past_due"].includes(s.status)) return !end || end > now;
    return s.status === "canceled" && !!end && end > now;
  }) ?? null;
}

function currentBillingPeriod(subscription: SubscriptionPeriod | null): { start: Date; end: Date } {
  if (
    subscription?.current_period_start &&
    subscription.current_period_end &&
    Number.isFinite(Date.parse(subscription.current_period_start)) &&
    Number.isFinite(Date.parse(subscription.current_period_end))
  ) {
    return {
      start: new Date(subscription.current_period_start),
      end: new Date(subscription.current_period_end),
    };
  }
  return { start: currentPeriodStart(), end: currentPeriodEnd() };
}

function hasVerifiedSubscriptionPeriod(subscription: SubscriptionPeriod | null): boolean {
  if (!subscription?.current_period_start || !subscription.current_period_end) return false;
  const start = Date.parse(subscription.current_period_start);
  const end = Date.parse(subscription.current_period_end);
  const now = Date.now();
  return Number.isFinite(start) && Number.isFinite(end) && start <= now && end > now;
}

async function usedChars(
  supabase: Client,
  userId: string,
  kind: AiUsageKind,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const { data, error } = await supabase
    .from("ai_usage")
    .select("chars")
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", periodStart.toISOString())
    .lt("created_at", periodEnd.toISOString());
  if (error) throw error;
  return (data ?? []).reduce((sum: number, r: { chars: number | null }) => sum + (r.chars ?? 0), 0);
}

export async function aiCreditStatusFor(
  supabase: Client,
  userId: string,
  claims: unknown,
): Promise<AiCreditStatus> {
  const isOwner = ownerFromClaims(claims);
  const subscription = isOwner ? null : await activeSubscription(supabase, userId);
  const hasSubscription = isOwner || subscription !== null;
  const period = currentBillingPeriod(subscription);
  const used = await usedChars(supabase, userId, "tts_cloud", period.start, period.end);
  const remaining = Math.max(0, TTS_MONTHLY_CHAR_LIMIT - used);
  const hasVerifiedCycle = isOwner || hasVerifiedSubscriptionPeriod(subscription);
  return {
    hasSubscription,
    isOwner,
    limit: TTS_MONTHLY_CHAR_LIMIT,
    used,
    remaining,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    allowed: hasSubscription && hasVerifiedCycle && remaining > 0,
  };
}

/** Erro com mensagem pronta para o usuário. */
export class AiCreditError extends Error {}

/** Server-side fallback for PilotAI endpoints whose Free quotas are not yet active. */
export async function assertProAiAllowed(
  supabase: Client,
  userId: string,
  claims: unknown,
): Promise<void> {
  if (ownerFromClaims(claims)) return;
  const subscription = await activeSubscription(supabase, userId);
  if (!subscription) {
    throw new AiCreditError(NO_SUBSCRIPTION_MESSAGE);
  }
  if (!hasVerifiedSubscriptionPeriod(subscription)) {
    throw new AiCreditError("Não foi possível confirmar o ciclo atual da assinatura.");
  }
}

/**
 * Chamar SEMPRE antes de gerar áudio novo na nuvem. Áudio reaproveitado do
 * catálogo não passa por aqui — não gera custo e não consome crédito.
 */
export async function assertCloudTtsAllowed(
  supabase: Client,
  userId: string,
  claims: unknown,
  chars: number,
): Promise<void> {
  const status = await aiCreditStatusFor(supabase, userId, claims);
  if (!status.hasSubscription) throw new AiCreditError(NO_SUBSCRIPTION_MESSAGE);
  if (!status.allowed && status.remaining > 0) {
    throw new AiCreditError("Não foi possível confirmar o ciclo atual da assinatura.");
  }
  if (status.remaining < chars) throw new AiCreditError(NO_CREDITS_MESSAGE);
}

/** Registra o consumo depois de a geração ter sido concluída com sucesso. */
export async function recordAiUsage(
  userId: string,
  kind: AiUsageKind,
  chars: number,
  lang?: string,
): Promise<void> {
  if (!Number.isSafeInteger(chars) || chars < 0) throw new Error("Invalid PilotAI usage amount");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("ai_usage").insert({
    user_id: userId,
    kind,
    chars,
    ...(lang ? { lang } : {}),
  });
  if (error) throw error;
}

/**
 * Fase 9/20 — mesma regra da voz em nuvem, aplicada à conversação.
 * Chamar SEMPRE antes de enviar mensagens ao modelo.
 */
export async function assertChatAllowed(
  supabase: Client,
  userId: string,
  claims: unknown,
  chars: number,
): Promise<void> {
  const { CHAT_MONTHLY_CHAR_LIMIT, NO_CHAT_CREDITS_MESSAGE, NO_CHAT_SUBSCRIPTION_MESSAGE } =
    await import("./ai-credits");
  const isOwner = ownerFromClaims(claims);
  const subscription = isOwner ? null : await activeSubscription(supabase, userId);
  const subscribed = isOwner || subscription !== null;
  if (!subscribed) throw new AiCreditError(NO_CHAT_SUBSCRIPTION_MESSAGE);
  const period = currentBillingPeriod(subscription);
  if (!isOwner && !hasVerifiedSubscriptionPeriod(subscription)) {
    throw new AiCreditError("Não foi possível confirmar o ciclo atual da assinatura.");
  }
  const used = await usedChars(supabase, userId, "chat", period.start, period.end);
  if (CHAT_MONTHLY_CHAR_LIMIT - used < chars) throw new AiCreditError(NO_CHAT_CREDITS_MESSAGE);
}

/**
 * Fase 20+ — chamar SEMPRE antes de enviar áudio ao provedor de transcrição.
 * O owner é isento; demais usuários precisam de assinatura ativa com ciclo
 * verificado e ainda ter chamadas restantes no mês (ver STT_MONTHLY_CALLS_LIMIT).
 */
export async function assertSttAllowed(
  supabase: Client,
  userId: string,
  claims: unknown,
): Promise<void> {
  const {
    STT_MONTHLY_CALLS_LIMIT,
    STT_FREE_MONTHLY_CALLS_LIMIT,
    NO_STT_SUBSCRIPTION_MESSAGE,
    NO_STT_CREDITS_MESSAGE,
    currentPeriodStart,
  } = await import("./ai-credits");
  const isOwner = ownerFromClaims(claims);
  if (isOwner) return;
  const subscription = await activeSubscription(supabase, userId);
  if (!subscription) {
    // Plano gratuito: cota mensal de ditados para que o aluno possa experimentar.
    const usedFree = await usedChars(supabase, userId, "stt", currentPeriodStart(), new Date());
    if (usedFree >= STT_FREE_MONTHLY_CALLS_LIMIT) throw new AiCreditError(NO_STT_SUBSCRIPTION_MESSAGE);
    return;
  }
  if (!hasVerifiedSubscriptionPeriod(subscription)) {
    throw new AiCreditError("Não foi possível confirmar o ciclo atual da assinatura.");
  }
  const period = currentBillingPeriod(subscription);
  const used = await usedChars(supabase, userId, "stt", period.start, period.end);
  if (used >= STT_MONTHLY_CALLS_LIMIT) throw new AiCreditError(NO_STT_CREDITS_MESSAGE);
}

/** Status da conversação para painéis. */
export async function chatCreditStatusFor(supabase: Client, userId: string, claims: unknown) {
  const { CHAT_MONTHLY_CHAR_LIMIT } = await import("./ai-credits");
  const isOwner = ownerFromClaims(claims);
  const subscription = isOwner ? null : await activeSubscription(supabase, userId);
  const hasSubscription = isOwner || subscription !== null;
  const period = currentBillingPeriod(subscription);
  const used = await usedChars(supabase, userId, "chat", period.start, period.end);
  const remaining = Math.max(0, CHAT_MONTHLY_CHAR_LIMIT - used);
  return {
    hasSubscription,
    isOwner,
    limit: CHAT_MONTHLY_CHAR_LIMIT,
    used,
    remaining,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
    cycleVerified: isOwner || hasVerifiedSubscriptionPeriod(subscription),
  };
}
