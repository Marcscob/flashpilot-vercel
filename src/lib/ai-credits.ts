/**
 * Fase 19 — camada única de créditos do PilotAI.
 *
 * Toda medida de consumo passa por aqui. Hoje a unidade medida é caractere
 * de voz em nuvem, conversação (`chat`), ditado (`stt`) e mapas mentais
 * (`mindmap`).
 */

export const AI_USAGE_KINDS = ["tts_cloud", "chat", "stt", "mindmap"] as const;
export type AiUsageKind = (typeof AI_USAGE_KINDS)[number];

/** Caracteres novos de voz em nuvem por mês. Áudio reaproveitado não conta. */
export const TTS_MONTHLY_CHAR_LIMIT = 100_000;

/** Início do período de contagem: primeiro instante do mês corrente (UTC). */
export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Início do mês seguinte — quando a contagem zera. */
export function currentPeriodEnd(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export type AiCreditStatus = {
  hasSubscription: boolean;
  isOwner: boolean;
  limit: number;
  used: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
  /** true = pode gerar voz em nuvem agora. */
  allowed: boolean;
};

export const NO_SUBSCRIPTION_MESSAGE =
  "A narração em nuvem é um recurso do Pro. Assine para ouvir a pronúncia gerada pelo PilotAI.";

export const NO_CREDITS_MESSAGE =
  "Você usou todos os caracteres de voz em nuvem deste mês. A contagem zera no início do próximo mês.";

/** Fase 9/19 — caracteres de conversação pelo PilotAI por mês (envio + resposta). */
export const CHAT_MONTHLY_CHAR_LIMIT = 200_000;

/** Reserve a safe response margin before starting a provider-backed chat turn. */
export const CHAT_REPLY_CHAR_RESERVE = 6_000;

export const NO_CHAT_SUBSCRIPTION_MESSAGE =
  "A conversação com o PilotAI é um recurso do Pro. Assine para praticar no idioma escolhido.";

export const NO_CHAT_CREDITS_MESSAGE =
  "Você usou toda a conversação com o PilotAI deste mês. A contagem zera no início do próximo mês.";

/**
 * Fase 20+ — o ditado por voz (STT) não tem custo em caracteres (o provedor
 * cobra por chamada/áudio), então o limite mensal é por NÚMERO DE CHAMADAS,
 * reaproveitando a mesma tabela `ai_usage` (1 unidade = 1 transcrição).
 */
export const STT_MONTHLY_CALLS_LIMIT = 300;

/** Ditados gratuitos por mês para quem ainda não assinou. */
export const STT_FREE_MONTHLY_CALLS_LIMIT = 60;

export const NO_STT_SUBSCRIPTION_MESSAGE =
  "O ditado por voz é um recurso do Pro. Assine para transcrever sua fala em texto.";

export const NO_STT_CREDITS_MESSAGE =
  "Você usou todas as transcrições por voz deste mês. A contagem zera no início do próximo mês.";

/**
 * Fase 19 — apresentação amigável: a unidade interna (caracteres) é convertida
 * em minutos aproximados de conversa. Estimativa de 650 caracteres por minuto
 * de troca (mensagem + resposta), suficiente para orientar o aluno.
 */
export const CHARS_PER_CHAT_MINUTE = 650;

export function chatMinutesRemaining(remainingChars: number): number {
  return Math.max(0, Math.floor(remainingChars / CHARS_PER_CHAT_MINUTE));
}
