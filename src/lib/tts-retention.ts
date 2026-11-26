/**
 * Fase 8 — origem e retenção do catálogo compartilhado de áudios (tts_cache).
 *
 * A origem separa o que é conteúdo oficial (feito pelo AppManager), material do
 * próprio aluno e áudio de conversação. Cada origem tem seu prazo de guarda,
 * contado desde o último uso: áudios sem uso são apagados pela limpeza.
 */
export const TTS_ORIGINS = ["official", "student", "chat"] as const;

export type TtsOrigin = (typeof TTS_ORIGINS)[number];

export const DEFAULT_TTS_ORIGIN: TtsOrigin = "student";

/** Dias sem uso até o áudio ser removido do catálogo. */
export const TTS_RETENTION_DAYS: Record<TtsOrigin, number> = {
  official: 365,
  student: 90,
  chat: 30,
};

export function isTtsOrigin(value: unknown): value is TtsOrigin {
  return typeof value === "string" && (TTS_ORIGINS as readonly string[]).includes(value);
}

/** Prioridade de guarda: origem mais duradoura vence quando o mesmo áudio é reusado. */
export function longerRetention(a: TtsOrigin, b: TtsOrigin): TtsOrigin {
  return TTS_RETENTION_DAYS[a] >= TTS_RETENTION_DAYS[b] ? a : b;
}
