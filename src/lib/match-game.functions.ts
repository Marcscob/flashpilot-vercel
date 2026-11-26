import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_DECKS_PER_DAY = 40;

const CreateInput = z.object({
  actionId: z.string().uuid(),
  topicId: z.string().uuid(),
  language: z.string().trim().max(20).nullable().optional(),
  cards: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(20_000),
        answer: z.string().trim().min(1).max(40_000),
      }),
    )
    .min(3)
    .max(60),
});

/**
 * Cria o FlashMatch (jogo de combinação) a partir de flashcards que o aluno acabou de salvar.
 * Só gera se os cards existirem no assunto do próprio usuário, o que impede usar a rota como IA livre.
 * Todo game criado entra na fila de curadoria (privada); só vira conteúdo oficial após aprovação humana.
 */
export const createMatchGameFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateMatchGame } = await import("./match-game-ai.server");
    const userId = context.userId;

    const existing = await supabaseAdmin
      .from("game_decks")
      .select("id, title")
      .eq("user_id", userId)
      .eq("action_id", data.actionId)
      .maybeSingle();
    if (existing.data) {
      const { count } = await supabaseAdmin
        .from("game_rounds")
        .select("id", { count: "exact", head: true })
        .eq("deck_id", existing.data.id);
      return {
        deckId: existing.data.id,
        title: existing.data.title,
        roundCount: count ?? 0,
        wasExisting: true,
      };
    }

    const topic = await supabaseAdmin
      .from("topics")
      .select("id")
      .eq("id", data.topicId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!topic.data) throw new Error("Assunto não encontrado.");

    const stored = await supabaseAdmin
      .from("flashcards")
      .select("question")
      .eq("user_id", userId)
      .eq("topic_id", data.topicId)
      .order("created_at", { ascending: false })
      .limit(2500);
    const storedQuestions = new Set((stored.data ?? []).map((row) => row.question.trim()));
    const matched = data.cards.filter((card) => storedQuestions.has(card.question.trim())).length;
    if (matched < Math.ceil(data.cards.length / 2)) {
      throw new Error("Salve os flashcards antes de criar o FlashMatch.");
    }

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const recent = await supabaseAdmin
      .from("game_decks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((recent.count ?? 0) >= MAX_DECKS_PER_DAY) {
      throw new Error("Limite diário de games atingido. Tente novamente amanhã.");
    }

    const { title, rounds } = await generateMatchGame(data.cards, AbortSignal.timeout(60_000));

    const deck = await supabaseAdmin
      .from("game_decks")
      .insert({
        user_id: userId,
        topic_id: data.topicId,
        kind: "match",
        title: title || "FlashMatch",
        language: data.language ?? null,
        action_id: data.actionId,
      })
      .select("id, title")
      .single();
    if (deck.error || !deck.data) throw new Error("Não foi possível salvar o FlashMatch.");

    const inserted = await supabaseAdmin.from("game_rounds").insert(
      rounds.map((round, position) => ({
        deck_id: deck.data.id,
        user_id: userId,
        position,
        payload: round,
      })),
    );
    if (inserted.error) {
      await supabaseAdmin.from("game_decks").delete().eq("id", deck.data.id);
      throw new Error("Não foi possível salvar o FlashMatch.");
    }
    const { submitGameForCuration } = await import("./game-curation.server");
    await submitGameForCuration(supabaseAdmin, {
      deckId: deck.data.id,
      userId,
      topicId: data.topicId,
      title: deck.data.title,
      language: data.language ?? null,
      rounds,
    });
    return {
      deckId: deck.data.id,
      title: deck.data.title,
      roundCount: rounds.length,
      wasExisting: false,
    };
  });
