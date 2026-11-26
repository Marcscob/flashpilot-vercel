/**
 * Etapa 6 — auditoria de conteúdo da comunidade.
 *
 * Regra: um card só é enviado para ao PilotAI validar depois de ter sido usado por
 * 3 pessoas diferentes (tabela flashcard_usage). Aprovado, recebe o selo
 * (flashcards.is_public_verified). Reprovado, apenas continua sem o selo —
 * nada é apagado e o card segue sendo do autor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "./app-manager";

/** Pessoas diferentes que precisam ter usado o card antes da validação. */
export const AUDIT_MIN_USERS = 3;

function assertAdmin(claims: unknown) {
  if (!isAppManagerIdentity(claims)) throw new Error("Área restrita ao AppManager.");
}

type PendingRow = { id: string; question: string; answer: string; users: number };

export async function pendingCards(limit: number, includeVerified = false): Promise<PendingRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: usage, error } = await supabaseAdmin
    .from("flashcard_usage")
    .select("flashcard_id, user_id")
    .limit(50000);
  if (error) throw new Error(error.message);

  const distinct = new Map<string, Set<string>>();
  for (const row of usage ?? []) {
    const set = distinct.get(row.flashcard_id) ?? new Set<string>();
    set.add(row.user_id);
    distinct.set(row.flashcard_id, set);
  }

  const eligible = [...distinct.entries()]
    .filter(([, users]) => users.size >= AUDIT_MIN_USERS)
    .map(([id, users]) => ({ id, users: users.size }));

  if (!eligible.length) return [];

  let query = supabaseAdmin
    .from("flashcards")
    .select("id, question, answer, is_public_verified")
    .in(
      "id",
      eligible.map((e) => e.id),
    )
    .limit(limit);
  if (!includeVerified) query = query.eq("is_public_verified", false);
  const { data: cards, error: cardsErr } = await query;
  if (cardsErr) throw new Error(cardsErr.message);

  const byId = new Map(eligible.map((e) => [e.id, e.users]));
  return (cards ?? []).map((c) => ({
    id: c.id,
    question: c.question ?? "",
    answer: c.answer ?? "",
    users: byId.get(c.id) ?? AUDIT_MIN_USERS,
  }));
}

/** Números da auditoria da comunidade para o painel do AppManager. */
export const communityAuditOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [pending, verified, shared] = await Promise.all([
      pendingCards(200),
      supabaseAdmin.from("flashcards").select("id", { count: "exact", head: true }).eq("is_public_verified", true),
      supabaseAdmin.from("flashcard_usage").select("flashcard_id").limit(50000),
    ]);

    const distinctShared = new Set((shared.data ?? []).map((r) => r.flashcard_id)).size;

    return {
      minUsers: AUDIT_MIN_USERS,
      pending: pending.length,
      verified: verified.count ?? 0,
      tracked: distinctShared,
      samples: pending.slice(0, 10).map((p) => ({
        id: p.id,
        users: p.users,
        question: p.question.slice(0, 120),
      })),
    };
  });

/** Envia para ao PilotAI os cards já usados por 3 pessoas diferentes e aplica o selo. */
export const runCommunityAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ limit: z.number().int().min(1).max(20).default(10) }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    assertAdmin(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditFlashcardWithAi, auditChars } = await import("./ugc.server");
    const { recordAiUsage } = await import("./ai-credits.server");
    const { runWithAiGenerationLease, throwIfAiGenerationAborted } = await import("./ai-quota.server");

    const cards = await pendingCards(data.limit);
    const results = await runWithAiGenerationLease(
      { userId: context.userId, actionId: crypto.randomUUID() },
      async (signal) => {
        const auditResults: Array<{ id: string; approved: boolean; reason: string }> = [];

        for (const card of cards) {
          try {
            const verdict = await auditFlashcardWithAi({
              question: card.question,
              answer: card.answer,
              signal,
            });
            throwIfAiGenerationAborted(signal);
            if (verdict.approved) {
              const { error } = await supabaseAdmin
                .from("flashcards")
                .update({ is_public_verified: true })
                .eq("id", card.id);
              if (error) throw new Error(error.message);
            }
            throwIfAiGenerationAborted(signal);
            await recordAiUsage(
              context.userId,
              "chat",
              auditChars(card.question, card.answer),
            );
            auditResults.push({ id: card.id, approved: verdict.approved, reason: verdict.reason });
          } catch (error: unknown) {
            if (signal.aborted) throw error;
            auditResults.push({
              id: card.id,
              approved: false,
              reason: error instanceof Error ? error.message : "Falha na auditoria.",
            });
          }
        }
        return auditResults;
      }
    );

    return {
      checked: results.length,
      approved: results.filter((r) => r.approved).length,
      rejected: results.filter((r) => !r.approved).length,
      results,
    };
  });
