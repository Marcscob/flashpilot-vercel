import { describe, expect, it } from "vitest";
import { buildEbook, moveSection, moveChapter, chapterHeading } from "../src/lib/ebook";

const t = (id: string, name: string, parent: string | null, o: number) => ({ id, name, parent_id: parent, order_index: o, created_at: "2026-01-01" });
const book = () => buildEbook("Python", "pt-BR",
  [t("c1", "Elementos do Python", null, 0), t("v", "Variáveis", "c1", 0), t("f", "Funções", "c1", 1)],
  [], [{ id: "k1", topic_id: "f", microcontext_id: null, question: "O que é def?", answer: "Define função", order_index: 0, created_at: "x" }]);

describe("ebook numbering", () => {
  it("numbers chapters and subchapters hierarchically", () => {
    const b = book();
    expect(chapterHeading(b.chapters[0]!)).toBe("Capítulo 1 - Elementos do Python");
    expect(b.chapters[0]!.sections.map((s) => `${s.number} - ${s.title}`)).toEqual(["1.1 - Variáveis", "1.2 - Funções"]);
  });
  it("renumbers when Funções is dragged before Variáveis", () => {
    const b = moveSection(book(), "c1", 1, 0);
    expect(b.chapters[0]!.sections.map((s) => `${s.number} - ${s.title}`)).toEqual(["1.1 - Funções", "1.2 - Variáveis"]);
    expect(b.chapters[0]!.sections[0]!.exercises[0]!.number).toBe("1.1.1");
  });
  it("renumbers chapters when moved", () => {
    const b = buildEbook("X", "pt", [t("a", "A", null, 0), t("b", "B", null, 1)], [], []);
    expect(moveChapter(b, 1, 0).chapters.map((c) => `${c.number} ${c.title}`)).toEqual(["1 B", "2 A"]);
  });
});

import { ebookFiles } from "../src/lib/ebook-epub";
describe("ebook epub", () => {
  it("keeps answers out of chapters and links both ways", () => {
    const f = ebookFiles(buildEbook("Python", "pt-BR", [t("c1", "Elementos", null, 0), t("f", "Funções", "c1", 0)], [], [{ id: "k1", topic_id: "f", microcontext_id: null, question: "Q?", answer: "Resposta secreta", order_index: 0, created_at: "x" }]), "u");
    expect(f["OEBPS/ch1.xhtml"]).not.toContain("Resposta secreta");
    expect(f["OEBPS/ch1.xhtml"]).toContain('href="answers.xhtml#ans-k1"');
    expect(f["OEBPS/answers.xhtml"]).toContain('href="ch1.xhtml#ex-k1"');
    expect(f["OEBPS/toc.ncx"]).toContain("1.1 - Funções");
  });
});

import { moveSectionTo as _mst, removeFromEbook as _rm, buildEbook as _b } from "../src/lib/ebook";
describe("cross-chapter moves and deletion", () => {
  const t = (id: string, parent: string | null, o: number) => ({ id, name: id, parent_id: parent, order_index: o, created_at: "2026-01-01" });
  const book = () => _b("S", "pt-BR", [t("c1", null, 0), t("c2", null, 1), t("a", "c1", 0), t("x", "c2", 0), t("y", "c2", 1), t("z", "c2", 2)], [], []);
  it("2.3 dragged to 1.2 is renumbered in both chapters", () => {
    const next = _mst(book(), "c2", 2, "c1", 1);
    expect(next.chapters[0]?.sections.map((s) => `${s.number}:${s.id}`)).toEqual(["1.1:a", "1.2:z"]);
    expect(next.chapters[1]?.sections.map((s) => `${s.number}:${s.id}`)).toEqual(["2.1:x", "2.2:y"]);
  });
  it("deleting 2.1 closes the numbering gap", () => {
    expect(_rm(book(), "x").chapters[1]?.sections.map((s) => s.number)).toEqual(["2.1", "2.2"]);
  });
});
