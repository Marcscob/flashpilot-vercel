/**
 * Fase 9 — função de servidor da conversação pelo PilotAI.
 *
 * Assinatura e crédito são verificados AQUI, antes de qualquer chamada externa
 * (Fase 20). Persistência da conversa é da Fase 10.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChatInput = z.object({
  lang: z.string().min(2).max(10),
  actionId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  // Fase 12 — nível e tema da conversa (opcionais; sem eles vale o padrão).
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  topic: z.string().min(1).max(40).optional(),
  // Fase 13 — modo pedagógico (opcional; sem ele vale conversação).
  mode: z.enum(["conversation", "teacher", "training", "repeat"]).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]).optional(),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(30),
});

/**
 * Segurança: quem fala cada turno é definido aqui, no servidor. O cliente só
 * envia textos; os papéis são recalculados alternadamente terminando em "user",
 * para que ninguém possa se passar pelo tutor nem sobrescrever as instruções.
 */
function withServerRoles(messages: Array<{ content: string }>) {
  const last = messages.length - 1;
  return messages.map((m, i) => ({
    role: (last - i) % 2 === 0 ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));
}

export const languageChatReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = ChatInput.parse(data);
    return { ...parsed, messages: withServerRoles(parsed.messages) };
  })
  .handler(async ({ data, context }) => {
    const { assertChatAllowed, AiCreditError, recordAiUsage } = await import("./ai-credits.server");
    const { AiQuotaPreflightError, authorizeAiChatTts, runWithAiQuota } =
      await import("./ai-quota.server");
    const { languageChatCompletion } = await import("./language-chat.server");

    // Fase 11 — se a tela indicou uma conversa, ela precisa ser do próprio usuário.
    // A verificação é feita no servidor, nunca apenas na tela.
    if (data.sessionId) {
      const { data: owned, error } = await context.supabase
        .from("language_chat_sessions")
        .select("id")
        .eq("id", data.sessionId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!owned) throw new Error("Conversa não encontrada.");
    }

    const inputChars = data.messages.reduce((sum, m) => sum + m.content.length, 0);
    const lastUserMessage = [...data.messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) throw new Error("Envie uma mensagem para continuar.");

    const billing: { receipt?: import("./ai-quota.server").AiBillingReceipt } = {};
    const { replyResult, isPro } = await runWithAiQuota(
      {
        userId: context.userId,
        actionId: data.actionId,
        jobId: data.sessionId ?? data.actionId,
        resource: "chat_turn",
        units: 1,
        coinActionId: "chat",
      },
      async ({ isPro }, signal) => {
        const inputLimit = isPro ? 2000 : 400;
        const contextLimit = isPro ? 60_000 : 21_000;
        if (lastUserMessage.content.length > inputLimit || inputChars > contextLimit) {
          throw new AiQuotaPreflightError(
            lastUserMessage.content.length > inputLimit
              ? `A mensagem excede o limite de ${inputLimit} caracteres do seu plano.`
              : `O histórico excede o limite de ${contextLimit.toLocaleString()} caracteres do seu plano.`,
          );
        }
        if (isPro) {
          try {
            const { CHAT_REPLY_CHAR_RESERVE } = await import("./ai-credits");
            await assertChatAllowed(
              context.supabase,
              context.userId,
              context.claims,
              inputChars + CHAT_REPLY_CHAR_RESERVE,
            );
          } catch (error) {
            if (error instanceof AiCreditError) throw new AiQuotaPreflightError(error.message);
            throw error;
          }
        }
        const replyResult = await languageChatCompletion(
          data.lang,
          data.messages,
          {
            level: data.level ?? null,
            topic: data.topic ?? null,
            mode: data.mode ?? null,
          },
          signal,
        );
        await recordAiUsage(context.userId, "chat", inputChars + replyResult.chars, data.lang);
        return {
          replyResult,
          isPro,
        };
      },
      (receipt) => {
        billing.receipt = receipt;
      },
    );
    const { reply, correction } = replyResult;
    const candidateSpeechText = reply.slice(0, isPro ? 1350 : 675);
    // A resposta em texto já foi gerada e a cota já foi debitada acima; uma falha
    // na autorização (opcional) de TTS não pode descartar a resposta do usuário.
    let speechText = "";
    try {
      await authorizeAiChatTts({
        userId: context.userId,
        actionId: data.actionId,
        text: candidateSpeechText,
      });
      speechText = candidateSpeechText;
    } catch (error) {
      console.error("Falha ao autorizar TTS da conversa; seguindo sem áudio.", error);
    }
    // Fase 14 — a correção volta separada da conversa, nunca embutida no texto.
    return {
      reply,
      correction,
      speechText,
      actionId: data.actionId,
      billing: billing.receipt ?? null,
    };
  });
