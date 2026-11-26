import { describe, expect, test } from "bun:test";
import { buildEbook, moveSection } from "../src/lib/ebook";
import { ebookNarration } from "../src/lib/ebook-narration";

const book = () => buildEbook("Python", "pt-BR", [
  { id: "topic", name: "Elementos", parent_id: null, order_index: 0, created_at: "2026-01-01" },
], [
  { id: "variables", topic_id: "topic", title: "Variáveis", content: "Valor armazenado.", order_index: 0, created_at: "2026-01-01" },
  { id: "functions", topic_id: "topic", title: "Funções", content: "Bloco reutilizável.\n\n[[img:user/photo.jpg|Diagrama de função]]", order_index: 1, created_at: "2026-01-01" },
], [{ id: "card", topic_id: "topic", microcontext_id: "functions", question: "O que é def?", answer: "Define uma função.", order_index: 0, created_at: "2026-01-01" }]);
const plain = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("ebook narration", () => {
  test("follows reordered sections and renumbered exercises", () => {
    const text = ebookNarration(moveSection(book(), "topic", 1, 0), plain);
    expect(text.indexOf("1.1 - Funções")).toBeLessThan(text.indexOf("1.2 - Variáveis"));
    expect(text).toContain("1.1.1. O que é def?");
  });
  test("reads captions, not image paths, and reserves answers for the final key", () => {
    const text = ebookNarration(book(), plain);
    expect(text).toContain("Diagrama de função");
    expect(text).not.toContain("user/photo.jpg");
    expect(text.indexOf("Define uma função.")).toBeGreaterThan(text.indexOf("Gabarito comentado"));
    expect(text.match(/Define uma função\./g)?.length).toBe(1);
  });
});