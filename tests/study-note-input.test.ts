import { describe, expect, it } from "vitest";
import { StudyNoteInput } from "../src/lib/study-note-input";

describe("Study note draft validation", () => {
  const base = { actionId: "123e4567-e89b-42d3-a456-426614174000", lang: "pt" };
  it("accepts bounded source text and regional language", () => {
    expect(StudyNoteInput.parse({ ...base, lang: "pt-PT", text: "a".repeat(40) }).lang).toBe("pt-PT");
  });
  it("rejects empty and oversized input before a paid call", () => {
    expect(StudyNoteInput.safeParse({ ...base, text: " " }).success).toBe(false);
    expect(StudyNoteInput.safeParse({ ...base, text: "a".repeat(20_001) }).success).toBe(false);
  });
});