import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { formatNotePartWithGroq } from "@/lib/notes-format.server";
import {
  AiQuotaPreflightError,
  authorizeAiNoteFormatPart,
  assertAiQuotaOrFeatureCoinHold,
  completeAiNoteFormatPart,
  runWithAiGenerationLease,
  runWithAiQuota,
  settleAiFeatureFlashcoins,
} from "./ai-quota.server";

const MAX_PARTS = 60;
const MAX_PART_CHARS = 6_000;

const FormatPartInput = z.object({
  actionId: z.string().uuid(),
  title: z.string().max(300).default(""),
  partIndex: z
    .number()
    .int()
    .min(0)
    .max(MAX_PARTS - 1),
  totalParts: z.number().int().min(1).max(MAX_PARTS),
  totalChars: z.number().int().min(1).max(60_000),
  chunk: z.string().min(1).max(MAX_PART_CHARS),
});

// Formats one part of a note. Part 0 reserves and consumes one "note_format"
// quota unit (validating the whole note size by plan); later parts reuse it.
export const formatNotePartWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FormatPartInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.partIndex >= data.totalParts) throw new Error("Parte inválida.");
    const part = { title: data.title, chunk: data.chunk, isFirst: data.partIndex === 0 };
    if (data.partIndex === 0) {
      const billing: { receipt?: import("./ai-quota.server").AiBillingReceipt } = {};
      const formatted = await runWithAiQuota(
        {
          userId: context.userId,
          actionId: data.actionId,
          jobId: data.actionId,
          resource: "note_format",
          units: 1,
          coinActionId: "note_format",
          deferCoinSettlement: data.totalParts > 1,
        },
        async ({ isPro }, signal) => {
          const maxChars = isPro ? 60_000 : 15_000;
          if (data.totalChars > maxChars) {
            throw new AiQuotaPreflightError(
              `A anotação excede o limite de ${maxChars.toLocaleString()} caracteres do seu plano.`,
            );
          }
          await authorizeAiNoteFormatPart({
            userId: context.userId,
            actionId: data.actionId,
            partIndex: data.partIndex,
            totalParts: data.totalParts,
            totalChars: data.totalChars,
            chunkChars: data.chunk.length,
          });
          const formatted = await formatNotePartWithGroq(part, signal);
          await completeAiNoteFormatPart({
            userId: context.userId,
            actionId: data.actionId,
            partIndex: data.partIndex,
            chunkChars: data.chunk.length,
          });
          return formatted;
        },
        (receipt) => {
          billing.receipt = receipt;
        },
      );
      if (billing.receipt?.source === "flashcoins_reserved") {
        return { ...formatted, billingHoldId: billing.receipt.holdId };
      }
      return { ...formatted, billing: billing.receipt ?? null };
    }
    const { coinHoldId } = await assertAiQuotaOrFeatureCoinHold({
      userId: context.userId,
      actionId: data.actionId,
      resource: "note_format",
    });
    await authorizeAiNoteFormatPart({
      userId: context.userId,
      actionId: data.actionId,
      partIndex: data.partIndex,
      totalParts: data.totalParts,
      totalChars: data.totalChars,
      chunkChars: data.chunk.length,
    });
    try {
      const formatted = await runWithAiGenerationLease(
        { userId: context.userId, actionId: data.actionId },
        (signal) => formatNotePartWithGroq(part, signal),
      );
      await completeAiNoteFormatPart({
        userId: context.userId,
        actionId: data.actionId,
        partIndex: data.partIndex,
        chunkChars: data.chunk.length,
      });
      if (coinHoldId && data.partIndex === data.totalParts - 1) {
        const receipt = await settleAiFeatureFlashcoins({
          userId: context.userId,
          holdId: coinHoldId,
          success: true,
        });
        return {
          ...formatted,
          billing: {
            source: "flashcoins" as const,
            chargedCoins: receipt.chargedCoins,
            balanceAfter: receipt.availableAfter,
          },
        };
      }
      return { ...formatted, ...(coinHoldId ? { billingHoldId: coinHoldId } : {}) };
    } catch (error) {
      if (coinHoldId && !(error instanceof AiQuotaPreflightError)) {
        try {
          await settleAiFeatureFlashcoins({
            userId: context.userId,
            holdId: coinHoldId,
            success: false,
            uncertain: true,
          });
        } catch (settlementError) {
          console.error(
            "Failed to preserve note-format coin hold after a failed chunk",
            settlementError,
          );
          throw new AggregateError(
            [error, settlementError],
            "A formatação falhou e a reserva de moedas precisa ser reconciliada.",
          );
        }
        throw new Error(
          "A formatação foi interrompida e a reserva de moedas precisa ser reconciliada.",
          {
            cause: error,
          },
        );
      }
      throw error;
    }
  });
