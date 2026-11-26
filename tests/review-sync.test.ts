import { describe, expect, it } from "vitest";
import {
  SYNC_REVIEW_MAX_BATCH,
  SyncReviewItemSchema,
  SyncReviewsInputSchema,
  syncReviewDecision,
} from "@/lib/review-sync";

const validItem = {
  flashcard_id: "3f6b1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b",
  quality: 4,
  base_version: 2,
  ease_factor: 2.5,
  interval_days: 4,
  repetitions: 1,
  due_date: "2026-10-31",
};

describe("syncReviewDecision (controle monotônico de versão)", () => {
  it("aplica quando a base do cliente é a versão atual", () => {
    expect(syncReviewDecision(2, 2)).toBe("applied");
  });

  it("aplica quando o cliente está à frente (linha recém-criada)", () => {
    expect(syncReviewDecision(0, 1)).toBe("applied");
  });

  it("conflita quando o servidor já avançou além da base do cliente", () => {
    expect(syncReviewDecision(3, 2)).toBe("conflict");
  });

  it("primeira revisão de um card novo (versão 0) aplica com base 0", () => {
    expect(syncReviewDecision(0, 0)).toBe("applied");
  });
});

describe("SyncReviewItemSchema", () => {
  it("aceita um item válido", () => {
    expect(SyncReviewItemSchema.parse(validItem)).toMatchObject({ quality: 4 });
  });

  it("rejeita quality fora de 0-5", () => {
    expect(() => SyncReviewItemSchema.parse({ ...validItem, quality: 6 })).toThrow();
    expect(() => SyncReviewItemSchema.parse({ ...validItem, quality: -1 })).toThrow();
  });

  it("rejeita ease_factor abaixo do piso do SM-2 (1.3)", () => {
    expect(() => SyncReviewItemSchema.parse({ ...validItem, ease_factor: 1.0 })).toThrow();
  });

  it("rejeita intervalo acima do teto absoluto de 30 dias", () => {
    expect(() => SyncReviewItemSchema.parse({ ...validItem, interval_days: 31 })).toThrow();
  });

  it("rejeita due_date fora do formato AAAA-MM-DD", () => {
    expect(() => SyncReviewItemSchema.parse({ ...validItem, due_date: "31/10/2026" })).toThrow();
  });

  it("rejeita base_version negativa", () => {
    expect(() => SyncReviewItemSchema.parse({ ...validItem, base_version: -1 })).toThrow();
  });
});

describe("SyncReviewsInputSchema", () => {
  it("exige ao menos uma revisão", () => {
    expect(() => SyncReviewsInputSchema.parse({ reviews: [] })).toThrow();
  });

  it(`limita o lote a ${SYNC_REVIEW_MAX_BATCH} revisões`, () => {
    const reviews = Array.from({ length: SYNC_REVIEW_MAX_BATCH + 1 }, () => validItem);
    expect(() => SyncReviewsInputSchema.parse({ reviews })).toThrow();
    const ok = Array.from({ length: SYNC_REVIEW_MAX_BATCH }, () => validItem);
    expect(SyncReviewsInputSchema.parse({ reviews: ok }).reviews).toHaveLength(SYNC_REVIEW_MAX_BATCH);
  });
});
