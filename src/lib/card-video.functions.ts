import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { generateCardVideoScenes } from "./card-video-generate.server";
import type { TvScene } from "./card-video";

const Input = z
  .object({
    actionId: z.string().uuid(),
    cardId: z.string().uuid().optional(),
    microcontextId: z.string().uuid().optional(),
    isOfficial: z.boolean(),
    question: z.string().min(1).max(4000),
    answer: z.string().min(1).max(6000),
    lang: z.string().trim().min(2).max(40),
    style: z.enum(["avatar", "motion", "both"]),
  })
  .refine((v) => (v.cardId == null) !== (v.microcontextId == null), {
    message: "Informe um card ou um bloco.",
  });

export const generateCardVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    let microcontextId: string | null = null;
    if (data.microcontextId) {
      // Bloco (Card 0): acesso pela RLS do próprio usuário; texto vem do banco, nunca do cliente.
      const { data: micro } = await context.supabase
        .from("microcontexts")
        .select("id, user_id, title, content")
        .eq("id", data.microcontextId)
        .maybeSingle();
      if (!micro) throw new Error("Bloco não encontrado.");
      microcontextId = micro.id;
      data = {
        ...data,
        isOfficial: false,
        question: micro.title.slice(0, 4000),
        answer: micro.content.slice(0, 6000),
      };
    } else {
      // Access is checked through the caller's own RLS; official status is derived server-side.
      const { data: card } = await context.supabase
        .from("flashcards")
        .select("id, user_id, question, answer")
        .eq("id", data.cardId!)
        .maybeSingle();
      if (!card) throw new Error("Card não encontrado.");
      const isOfficial = card.user_id !== context.userId;
      data = {
        ...data,
        isOfficial,
        question: card.question || data.question,
        answer: card.answer || data.answer,
      };
    }
    const cacheMod = await import("./ai-result-cache.server");
    const cacheKey = await cacheMod.aiCacheKey(
      "video-script",
      data.lang,
      data.style,
      data.question,
      data.answer,
    );
    const cachedScenes = await cacheMod.readAiCache<TvScene[]>(cacheKey);
    const { runWithAiQuota } = await import("./ai-quota.server");
    const scenes =
      cachedScenes && cachedScenes.length
        ? cachedScenes
        : await runWithAiQuota(
            {
              userId: context.userId,
              actionId: data.actionId,
              jobId: data.actionId,
              resource: "note_format",
              units: 1,
              coinActionId: "note_format",
            },
            (_r, signal) =>
              generateCardVideoScenes(
                {
                  question: data.question,
                  answer: data.answer,
                  lang: data.lang,
                  style: data.style,
                },
                signal,
              ),
          );
    if (!cachedScenes) await cacheMod.writeAiCache("video-script", cacheKey, scenes);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const transcript = scenes.map((s) => s.speech).join("\n\n");
    const { data: row, error } = await supabaseAdmin
      .from("card_videos")
      .insert({
        user_id: context.userId,
        card_id: data.cardId ?? null,
        microcontext_id: microcontextId,
        is_official: data.isOfficial,
        lang: data.lang,
        style: data.style,
        scenes,
        transcript,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try {
      const { prerenderCardVideoAudio } = await import("./card-video-audio.server");
      await prerenderCardVideoAudio(row.id, context.userId);
    } catch (audioError) {
      // O vídeo já existe; sem áudio pré-gerado ele apenas será narrado no primeiro play.
      console.error("Card video narration pre-render failed", audioError);
    }
    return { id: row.id };
  });
