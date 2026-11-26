import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getPaddleEnvironment } from "./paddle";

const SaveInput = z.object({
  actionId: z.string().uuid(),
  cards: z
    .array(
      z.object({
        topicId: z.string().uuid(),
        question: z.string().trim().min(1).max(20_000),
        answer: z.string().trim().min(1).max(40_000),
        questionOriginal: z.string().max(20_000).nullable().optional(),
        answerOriginal: z.string().max(40_000).nullable().optional(),
        cardFormat: z.string().max(40).optional(),
        reviewed: z.boolean().optional(),
        orderIndex: z.number().int().nullable().optional(),
        language: z.string().max(20).nullable().optional(),
        linkedNoteId: z.string().uuid().nullable().optional(),
        imageUrl: z.string().max(2048).nullable().optional(),
        imageCategoryId: z.string().uuid().nullable().optional(),
        imagePins: z
          .array(
            z.object({
              n: z.number().int().min(1).max(30),
              label: z.string().trim().min(1).max(200),
              x: z.number().min(0).max(1000),
              y: z.number().min(0).max(1000),
              confidence: z.number().min(0).max(1).optional(),
            }),
          )
          .max(30)
          .nullable()
          .optional(),
        imageFocus: z.number().int().min(1).max(30).nullable().optional(),
        videoUrl1: z.string().max(2048).nullable().optional(),
        videoUrl2: z.string().max(2048).nullable().optional(),
        generatedJobId: z.string().uuid().nullable().optional(),
        generatedOutputId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1)
    .max(2500),
});

export const saveFlashcardsAtomically = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cards = data.cards.map((card) => ({
      topic_id: card.topicId,
      question: card.question,
      answer: card.answer,
      question_original: card.questionOriginal ?? null,
      answer_original: card.answerOriginal ?? null,
      card_format: card.cardFormat ?? "plain",
      reviewed: card.reviewed ?? false,
      order_index: card.orderIndex ?? null,
      language: card.language ?? null,
      linked_note_id: card.linkedNoteId ?? null,
      image_url: card.imageUrl ?? null,
      image_category_id: card.imageCategoryId ?? null,
      image_pins: card.imagePins && card.imagePins.length > 0 ? card.imagePins : null,
      image_focus: card.imageFocus ?? null,
      video_url_1: card.videoUrl1 ?? null,
      video_url_2: card.videoUrl2 ?? null,
      generated_job_id: card.generatedJobId ?? null,
      generated_output_id: card.generatedOutputId ?? null,
    }));
    const { data: result, error } = await supabaseAdmin.rpc("save_flashcards_atomically", {
      p_user_id: context.userId,
      p_action_id: data.actionId,
      p_cards: cards,
      p_environment: getPaddleEnvironment(),
    });
    if (error) {
      if (error.code === "P0001") throw new Error(error.message);
      if (error.code === "P0003") throw new Error(error.message);
      throw error;
    }
    const receipt = result?.[0];
    if (!receipt) throw new Error("Flashcard save returned no receipt.");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("flashcoins_balance")
      .eq("user_id", context.userId)
      .single();
    if (profileError) throw profileError;
    const { data: ledgerEntries, error: ledgerError } = await supabaseAdmin
      .from("flashcoin_ledger")
      .select("amount")
      .eq("user_id", context.userId)
      .like("action_id", `flashcards-save:${data.actionId}:%`);
    if (ledgerError) throw ledgerError;
    return {
      insertedCount: receipt.inserted_count,
      balance: Number(profile.flashcoins_balance),
      chargedCoins: receipt.was_existing
        ? 0
        : (ledgerEntries ?? []).reduce((total, entry) => total - Number(entry.amount), 0),
      wasExisting: receipt.was_existing,
    };
  });
