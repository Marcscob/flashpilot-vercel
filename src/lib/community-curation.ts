import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
export const CurationDraftSchema = z.object({
  question: text(4000), answer: text(12000),
  subject: text(160), chapter: text(160), topic: text(160),
  language: text(20), reference: z.string().trim().max(2000),
});
export const CurationVerdictSchema = CurationDraftSchema.extend({
  eligible: z.boolean(), reason: text(2000),
  risk: z.enum(["public_fact", "rights_uncertain", "personal_data", "incorrect", "not_study"]),
});
export const CurationReviewSchema = CurationDraftSchema.extend({
  id: z.string().uuid(), version: z.number().int().min(1),
  decision: z.enum(["save", "approve", "reject"]),
  reviewNotes: text(4000), rightsNotes: text(4000),
  rightsConfirmed: z.boolean(),
  materials: z.object({
    note: z.boolean().default(false),
    map: z.boolean().default(false),
    links: z.boolean().default(false),
    videoIds: z.array(z.string().uuid()).max(20).default([]),
  }).default({ note: false, map: false, links: false, videoIds: [] }),
}).superRefine((value, ctx) => {
  if (value.decision === "approve" && !value.rightsConfirmed) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rightsConfirmed"], message: "Confirme os direitos de uso comercial." });
  }
});
export function canIncorporateCuration(status: string, eligible: boolean, rightsConfirmed: boolean) {
  return status === "pending" && eligible && rightsConfirmed;
}
export type CurationDraft = z.infer<typeof CurationDraftSchema>;
export type CurationMaterialsPick = { note: boolean; map: boolean; links: boolean; videoIds: string[] };
/** Only materials the curator ticked AND that exist on the student card are carried over. */
export function selectedMaterials(pick: CurationMaterialsPick, available: { note: boolean; map: boolean; links: boolean; videoIds: string[] }): CurationMaterialsPick {
  const ok = new Set(available.videoIds);
  return { note: pick.note && available.note, map: pick.map && available.map, links: pick.links && available.links, videoIds: pick.videoIds.filter(id => ok.has(id)) };
}
