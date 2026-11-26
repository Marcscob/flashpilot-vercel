import { describe, expect, it } from "vitest";
import { canEditEbook, ebookEditKey } from "../src/lib/ebook-edit";
import { buildEbook } from "../src/lib/ebook";
import { ebookFiles } from "../src/lib/ebook-epub";

describe("ebook editing", () => {
  it("permits editing the student's own book and own rows", () => {
    expect(canEditEbook("student", "student", "student")).toBe(true);
  });
  it("keeps official books read-only for students", () => {
    expect(canEditEbook("student", "manager", "manager")).toBe(false);
    expect(canEditEbook("student", "manager", "student")).toBe(false);
  });
  it("does not permit editing another owner's row or signed-out edits", () => {
    expect(canEditEbook("student", "student", "manager")).toBe(false);
    expect(canEditEbook(null, "student", "student")).toBe(false);
  });
  it("keeps question and answer edits independent", () => {
    expect(ebookEditKey({ table: "flashcards", field: "question", id: "card" })).not.toBe(ebookEditKey({ table: "flashcards", field: "answer", id: "card" }));
  });
  it("exports updated exercises while keeping solutions only in the final key", () => {
    const book = buildEbook("Python", "pt-BR", [{ id: "t", name: "C", parent_id: null, order_index: 0, created_at: "x" }], [], [{ id: "e", topic_id: "t", microcontext_id: null, question: "Qual é o resultado de 5 + 3?", answer: "O resultado é 8.\n\nExemplo:\nx = 5 + 3\nif x > 0:\n    print(x)", order_index: 0, created_at: "x" }]);
    const files = ebookFiles(book, "id");
    expect(files["OEBPS/ch1.xhtml"]).toContain("Qual é o resultado de 5 + 3?");
    expect(files["OEBPS/ch1.xhtml"]).not.toContain("O resultado é 8.");
    expect(files["OEBPS/answers.xhtml"]).toContain("O resultado é 8.");
    expect(files["OEBPS/answers.xhtml"]).toContain("    print(x)");
    expect(files["OEBPS/answers.xhtml"]).toContain("<pre><code>");
  });
});