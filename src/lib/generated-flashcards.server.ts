import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPaddleEnvironment } from "./paddle";
import { AiQuotaPreflightError, TrialExpiredError } from "./ai-quota.server";
import { getErrorMessage } from "./error-message";

export type GeneratedFlashcardBillingReservation = {
  id: string;
  holdId: string | null;
  includedUnits: number;
  coinsReserved: number;
  availableAfter: number;
};

export type RegisteredGeneratedFlashcard = {
  outputId: string;
  question: string;
  answer: string;
  imageIndex: number | null;
};

class GeneratedFlashcardRegistrationError extends Error {
  constructor(readonly originalError: unknown) {
    super("Generated flashcard registration could not be confirmed.");
  }
}

export async function reserveGeneratedFlashcardBilling(input: {
  userId: string;
  actionId: string;
  jobId: string;
  requestedCards: number;
}): Promise<GeneratedFlashcardBillingReservation> {
  const { data, error } = await supabaseAdmin.rpc("reserve_ai_generated_flashcard_billing", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_job_id: input.jobId,
    p_requested_units: input.requestedCards,
    p_environment: getPaddleEnvironment(),
  });
  if (error) {
    if (error.code === "P0003") throw new TrialExpiredError(error.message);
    throw error;
  }
  const row = data?.[0];
  if (!row) throw new Error("Generated flashcard billing reservation returned no result.");
  return {
    id: row.billing_reservation_id,
    holdId: row.hold_id,
    includedUnits: row.included_units,
    coinsReserved: row.coins_reserved,
    availableAfter: Number(row.available_after),
  };
}

export async function withGeneratedFlashcardBilling<T>(
  input: {
    userId: string;
    actionId: string;
    jobId: string;
    requestedCards: number;
  },
  operation: (reservation: GeneratedFlashcardBillingReservation) => Promise<T>,
): Promise<T> {
  let reservation: GeneratedFlashcardBillingReservation;
  try {
    reservation = await reserveGeneratedFlashcardBilling(input);
  } catch (error) {
    throw new AiQuotaPreflightError(
      getErrorMessage(error, "Generated flashcard reservation could not be verified."),
    );
  }
  try {
    return await operation(reservation);
  } catch (error) {
    const uncertain = !(error instanceof AiQuotaPreflightError);
    try {
      await settleGeneratedFlashcardBilling({
        userId: input.userId,
        actionId: input.actionId,
        uncertain,
      });
    } catch (settlementError) {
      throw new AggregateError(
        [error, settlementError],
        "Flashcard generation failed and its billing reservation could not be reconciled.",
      );
    }
    throw error;
  }
}

export async function settleGeneratedFlashcardBilling(input: {
  userId: string;
  actionId: string;
  uncertain: boolean;
}): Promise<void> {
  const { error } = await supabaseAdmin.rpc("settle_ai_generated_flashcard_billing", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_uncertain: input.uncertain,
  });
  if (error) throw error;
}

export async function getRegisteredGeneratedFlashcards(input: {
  userId: string;
  actionId: string;
  jobId: string;
}): Promise<RegisteredGeneratedFlashcard[]> {
  const { data, error } = await supabaseAdmin.rpc("get_ai_generated_flashcards", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_job_id: input.jobId,
  });
  if (error) throw error;
  const cards = [...(data ?? [])]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((row) => ({
      outputId: row.output_id,
      question: row.question,
      answer: row.answer,
      imageIndex: row.image_index,
    }));
  if (cards.length) {
    const { error: settleError } = await supabaseAdmin.rpc(
      "settle_ai_quota_for_generated_flashcards",
      {
        p_user_id: input.userId,
        p_action_id: input.actionId,
        p_job_id: input.jobId,
      },
    );
    if (settleError) throw settleError;
  }
  return cards;
}

export async function registerGeneratedFlashcardOutputs(input: {
  userId: string;
  actionId: string;
  jobId: string;
  leaseId: string;
  requestedCards: number;
  cards: Array<{ question: string; answer: string; image_index?: number | null }>;
}): Promise<string[]> {
  if (input.cards.length === 0) return [];
  if (input.cards.length > input.requestedCards) {
    throw new GeneratedFlashcardRegistrationError(
      new Error("Generated flashcard count exceeded the prepaid request."),
    );
  }

  const cards = input.cards.map((card) => ({
    question: card.question.trim(),
    answer: card.answer.trim(),
    image_index: card.image_index ?? null,
  }));
  const { data, error } = await supabaseAdmin.rpc("register_ai_generated_flashcards_pre_reserved", {
    p_user_id: input.userId,
    p_action_id: input.actionId,
    p_job_id: input.jobId,
    p_lease_id: input.leaseId,
    p_cards: cards,
    p_environment: getPaddleEnvironment(),
  });
  if (error) throw new GeneratedFlashcardRegistrationError(error);

  const outputIds = [...(data ?? [])]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((row) => row.output_id);
  if (outputIds.length !== input.cards.length) {
    throw new GeneratedFlashcardRegistrationError(
      new Error("Generated flashcard registration returned an incomplete result."),
    );
  }
  return outputIds;
}
