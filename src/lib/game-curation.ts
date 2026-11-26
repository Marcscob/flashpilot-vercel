import { z } from "zod";
import { matchRoundSchema } from "./match-game";

const text = (max: number) => z.string().trim().min(1).max(max);

export const GAME_CURATION_RISKS = [
  "public_fact",
  "rights_uncertain",
  "personal_data",
  "incorrect",
  "not_study",
] as const;

export const GameCurationDraftSchema = z.object({
  title: text(120),
  subject: text(160),
  chapter: text(160),
  topic: text(160),
  language: text(20),
  rounds: z.array(matchRoundSchema).min(1).max(12),
});

export const GameCurationReviewSchema = GameCurationDraftSchema.extend({
  id: z.string().uuid(),
  version: z.number().int().min(1),
  decision: z.enum(["save", "approve", "reject"]),
  reviewNotes: text(4000),
  rightsNotes: text(4000),
  rightsConfirmed: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.decision === "approve" && !value.rightsConfirmed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rightsConfirmed"],
      message: "Confirme os direitos de uso comercial.",
    });
  }
});

export const GameAuditSchema = z.object({
  eligible: z.boolean(),
  risk: z.enum(GAME_CURATION_RISKS),
  reason: text(2000),
  subject: z.string().trim().max(160).default(""),
  chapter: z.string().trim().max(160).default(""),
  topic: z.string().trim().max(160).default(""),
});

export type GameCurationDraft = z.infer<typeof GameCurationDraftSchema>;

/** Matéria > capítulo > assunto sugeridos a partir do assunto do aluno (o curador pode editar). */
export function candidateTaxonomy(input: {
  subject: string;
  topic: string;
  parent?: string | null;
}): { subject: string; chapter: string; topic: string } {
  return {
    subject: input.subject.trim(),
    chapter: input.parent?.trim() || input.topic.trim(),
    topic: input.topic.trim(),
  };
}

/** Só um candidato pendente, auditado como elegível e com direitos confirmados pode ser incorporado. */
export function canIncorporateGame(
  status: string,
  eligible: boolean,
  rightsConfirmed: boolean,
): boolean {
  return status === "pending" && eligible && rightsConfirmed;
}
