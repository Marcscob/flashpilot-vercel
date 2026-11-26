import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TranslateInput = z.object({
  actionId: z.string().uuid(),
  text: z.string().min(1).max(4000),
  lang: z.string().min(2).max(10).optional(),
  targetLang: z.string().min(2).max(10),
});

/** Tradução momentânea do texto visível do card para o idioma do usuário (não grava nada). */
export const translateCardText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TranslateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertChatAllowed, recordAiUsage, AiCreditError } = await import("./ai-credits.server");
    const { AiQuotaPreflightError, runWithAiQuota } = await import("./ai-quota.server");
    const { translateFlashcardText } = await import("./translate-text.server");
    const cache = await import("./translation-cache.server");

    const key = await cache.translationCacheKey(data.text, data.targetLang, data.lang);
    const hit = await cache.readCachedTranslation(key);
    if (hit) return { text: hit };

    const chars = data.text.length;
    const translated = await runWithAiQuota(
      {
        userId: context.userId,
        actionId: data.actionId,
        jobId: data.actionId,
        resource: "chat_turn",
        units: 1,
      },
      async (_, signal) => {
        try {
          await assertChatAllowed(context.supabase, context.userId, context.claims, chars * 3);
        } catch (error) {
          if (error instanceof AiCreditError) throw new AiQuotaPreflightError(error.message);
          throw error;
        }
        const result = await translateFlashcardText(data.text, data.targetLang, data.lang, signal);
        await recordAiUsage(context.userId, "chat", chars + result.length, data.lang);
        return result;
      },
    );
    await cache.saveCachedTranslation(key, data.lang, translated);
    return { text: translated };
  });
