import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeSm2 } from "./sm2";
import { SyncReviewsInputSchema } from "./review-sync";

const ReviewInput = z.object({
  flashcard_id: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
});

export const reviewFlashcard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReviewInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: card, error: fetchErr } = await supabase
      .from("flashcards")
      .select("id, user_id, ease_factor, interval_days, repetitions, due_date, revision_version")
      .eq("id", data.flashcard_id)
      .single();

    if (fetchErr || !card) throw new Error("Flashcard não encontrado");

    // Card oficial (de outra conta, liberado por compra): o progresso do aluno
    // fica em official_card_progress, sem tocar no conteúdo do autor.
    const isOwn = card.user_id === userId;
    let state = {
      ease_factor: card.ease_factor,
      interval_days: card.interval_days,
      repetitions: card.repetitions,
    };
    let previousDue: string | null = (card as any).due_date ?? null;
    let currentVersion = Number((card as any).revision_version ?? 0);

    if (!isOwn) {
      const { data: progress } = await supabase
        .from("official_card_progress")
        .select("ease_factor, interval_days, repetitions, due_date, revision_version")
        .eq("user_id", userId)
        .eq("flashcard_id", data.flashcard_id)
        .maybeSingle();
      state = {
        ease_factor: progress?.ease_factor ?? 2.5,
        interval_days: progress?.interval_days ?? 0,
        repetitions: progress?.repetitions ?? 0,
      };
      previousDue = progress?.due_date ?? null;
      currentVersion = Number((progress as any)?.revision_version ?? 0);
    }

    const next = computeSm2(state, data.quality);

    const reviewedAt = new Date().toISOString();

    if (isOwn) {
      const { error: updErr } = await supabase
        .from("flashcards")
        .update({
          ease_factor: next.ease_factor,
          interval_days: next.interval_days,
          repetitions: next.repetitions,
          due_date: next.due_date,
          last_reviewed_at: reviewedAt,
          revision_version: currentVersion + 1,
        })
        .eq("id", data.flashcard_id)
        .eq("user_id", userId);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { error: progErr } = await supabase.from("official_card_progress").upsert(
        {
          user_id: userId,
          flashcard_id: data.flashcard_id,
          ease_factor: next.ease_factor,
          interval_days: next.interval_days,
          repetitions: next.repetitions,
          due_date: next.due_date,
          last_reviewed_at: reviewedAt,
          revision_version: currentVersion + 1,
          updated_at: reviewedAt,
        },
        { onConflict: "user_id,flashcard_id" },
      );
      if (progErr) throw new Error(progErr.message);
    }

    // Append immutable history row (best-effort; do not fail the review UX)
    const { error: histErr } = await supabase.from("flashcard_reviews").insert({
      user_id: userId,
      flashcard_id: data.flashcard_id,
      quality: data.quality,
      previous_due_date: previousDue,
      next_due_date: next.due_date,
      interval_days: next.interval_days,
      ease_factor: next.ease_factor,
      repetitions: next.repetitions,
      reviewed_at: reviewedAt,
    });
    if (histErr) console.error("flashcard_reviews insert failed", histErr);

    // Etapa 6 — quem usou o card (uma vez por pessoa). Base da auditoria da
    // comunidade; falha aqui nunca atrapalha a revisão.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: usageErr } = await supabaseAdmin
      .from("flashcard_usage")
      .upsert(
        { flashcard_id: data.flashcard_id, user_id: userId },
        { onConflict: "flashcard_id,user_id", ignoreDuplicates: true },
      );
    if (usageErr) console.error("flashcard_usage upsert failed", usageErr);

    return next;
  });


// Sincronização em lote das revisões feitas offline. O cliente envia o estado
// SM-2 já calculado e a versão-base; o banco aplica com controle monotônico
// (função sync_flashcard_reviews) e devolve o resultado por card.
export const syncFlashcardReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SyncReviewsInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: result, error } = await supabase.rpc("sync_flashcard_reviews", {
      p_user_id: userId,
      p_reviews: data.reviews,
    });
    if (error) throw new Error(error.message);
    return { results: result ?? [] };
  });

export const resetAllReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    const { error: updErr, count } = await supabase
      .from("flashcards")
      .update(
        {
          ease_factor: 2.5,
          interval_days: 0,
          repetitions: 0,
          due_date: today,
          last_reviewed_at: null,
        },
        { count: "exact" },
      )
      .eq("user_id", userId);

    if (updErr) throw new Error(updErr.message);

    const { error: histErr } = await supabase
      .from("flashcard_reviews")
      .delete()
      .eq("user_id", userId);
    if (histErr) throw new Error(histErr.message);

    return { reset: count ?? 0 };
  });
