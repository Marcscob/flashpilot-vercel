import { z } from "zod";

// Sincronização offline em lote de revisões (SM-2).
// O cliente calcula o próximo estado com computeSm2 e envia junto a versão em
// que se baseou (base_version). O servidor aplica somente quando a versão
// ainda é atual (controle monotônico); caso contrário devolve "conflict" para
// o cliente recalcular a partir do estado vigente.

export const SYNC_REVIEW_MAX_BATCH = 500;

export const SyncReviewItemSchema = z.object({
  flashcard_id: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
  base_version: z.number().int().min(0),
  ease_factor: z.number().min(1.3),
  interval_days: z.number().int().min(0).max(30),
  repetitions: z.number().int().min(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  last_reviewed_at: z.string().optional(),
});

export const SyncReviewsInputSchema = z.object({
  reviews: z.array(SyncReviewItemSchema).min(1).max(SYNC_REVIEW_MAX_BATCH),
});

export type SyncReviewItem = z.infer<typeof SyncReviewItemSchema>;

export type SyncReviewStatus = "applied" | "conflict";

// Decisão monotônica: aplica quando o cliente partiu da versão atual (ou de
// uma mais nova, ex.: linha recém-criada); conflita quando o servidor já
// avançou além da base do cliente.
export function syncReviewDecision(currentVersion: number, baseVersion: number): SyncReviewStatus {
  return baseVersion >= currentVersion ? "applied" : "conflict";
}
