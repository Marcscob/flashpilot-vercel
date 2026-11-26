import { describe, it, expect } from "vitest";
import { canIncorporateCuration, CurationReviewSchema, CurationVerdictSchema } from "@/lib/community-curation";
const draft = { question: "O que é um fato público?", answer: "Um fato de conhecimento público.", subject: "Conhecimento", chapter: "Fundamentos", topic: "Fatos", language: "pt", reference: "" };
const review = { ...draft, id: "3f6b1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b", version: 1, decision: "approve", reviewNotes: "Verificado por humano", rightsNotes: "Autorização do contribuinte e fonte em domínio público", rightsConfirmed: true };
describe("curadoria comercial", () => {
  it("exige confirmação humana de direitos para aprovar", () => { expect(CurationReviewSchema.safeParse({ ...review, rightsConfirmed: false }).success).toBe(false); });
  it("exige parecer humano", () => { expect(CurationReviewSchema.safeParse({ ...review, reviewNotes: "" }).success).toBe(false); });
  it("exige taxonomia completa", () => { expect(CurationReviewSchema.safeParse({ ...review, topic: "" }).success).toBe(false); });
  it("aceita aprovação humana com direitos e taxonomia", () => { expect(CurationReviewSchema.safeParse(review).success).toBe(true); });
  it("não permite incorporar candidato não elegível", () => { expect(canIncorporateCuration("pending", false, true)).toBe(false); });
  it("não permite incorporar sem confirmação de direitos", () => { expect(canIncorporateCuration("pending", true, false)).toBe(false); });
  it("não reincorpora aprovado", () => { expect(canIncorporateCuration("approved", true, true)).toBe(false); });
  it("não incorpora rejeitado", () => { expect(canIncorporateCuration("rejected", true, true)).toBe(false); });
  it("incorpora apenas pendente elegível com confirmação humana", () => { expect(canIncorporateCuration("pending", true, true)).toBe(true); });
  it("rejeita verdict sem classificação de risco", () => { expect(CurationVerdictSchema.safeParse({ ...draft, eligible: true, reason: "Fato público" }).success).toBe(false); });
});