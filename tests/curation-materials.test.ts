import { describe, it, expect } from "vitest";
import { selectedMaterials, CurationReviewSchema } from "@/lib/community-curation";

describe("curation materials", () => {
  it("copies nothing unless ticked", () => {
    expect(CurationReviewSchema.parse({ question: "q", answer: "a", subject: "s", chapter: "c", topic: "t", language: "pt", reference: "", id: "00000000-0000-4000-8000-000000000000", version: 1, decision: "save", reviewNotes: "n", rightsNotes: "r", rightsConfirmed: false }).materials).toEqual({ note: false, map: false, links: false, videoIds: [] });
  });
  it("keeps only ticked materials that exist on the student card", () => {
    expect(selectedMaterials({ note: true, map: true, links: false, videoIds: ["a", "x"] }, { note: true, map: false, links: true, videoIds: ["a", "b"] }))
      .toEqual({ note: true, map: false, links: false, videoIds: ["a"] });
  });
});
