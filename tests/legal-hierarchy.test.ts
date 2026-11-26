import { describe, expect, it } from "vitest";
import { splitLegalText } from "../src/lib/legal-hierarchy";

const CLT = `CONSOLIDAÇÃO DAS LEIS DO TRABALHO

TÍTULO I

INTRODUÇÃO

Art. 1º - Esta Consolidação estatui as normas.

Art. 2º - Considera-se empregador a empresa.

§ 1º - Equiparam-se ao empregador os profissionais liberais.

TÍTULO II

DAS NORMAS GERAIS DE TUTELA DO TRABALHO

CAPÍTULO I

DA IDENTIFICAÇÃO PROFISSIONAL

SEÇÃO I

DA CARTEIRA DE TRABALHO E PREVIDÊNCIA SOCIAL

Art. 13 - A Carteira de Trabalho e Previdência Social é obrigatória.

§ 1º - O disposto neste artigo aplica-se, igualmente, a quem:

I - proprietário rural ou não, trabalhe individualmente;

SEÇÃO II

DA EMISSÃO DA CARTEIRA

Art. 14 - A CTPS será emitida pelo Ministério.`;

describe("legal hierarchy", () => {
  const r = splitLegalText(CLT)!;
  it("subject is the law title", () => expect(r.subject).toBe("Consolidação das Leis do Trabalho"));
  it("article under chapter/section: assunto = chapter, tópico = section; Título II ignored", () => {
    const u = r.units.find((x) => x.text.includes("Art. 13"))!;
    expect(u.topic).toBe("Da Identificação Profissional");
    expect(u.subtopic).toBe("Da Carteira de Trabalho e Previdência Social");
    expect(u.text).toContain("I - proprietário rural");
  });
  it("new section keeps the chapter as assunto", () => {
    const u = r.units.find((x) => x.text.includes("Art. 14"))!;
    expect(u.topic).toBe("Da Identificação Profissional");
    expect(u.subtopic).toBe("Da Emissão da Carteira");
  });
  it("only one heading above the articles becomes the assunto", () => {
    const u = r.units[0]!;
    expect(u.topic).toBe("Introdução");
    expect(u.subtopic).toBeUndefined();
    expect(u.text).toContain("Art. 2º");
  });
  it("non-legal text is ignored", () => expect(splitLegalText("Texto corrido sobre Python.\nOutro parágrafo.")).toBeNull());
});

describe("editorial noise", () => {
  it("ignores (VETADO) and uppercase footnotes as headings", async () => {
    const { splitLegalText } = await import("../src/lib/legal-hierarchy");
    const t = ["LEI GERAL DE TESTE", "CAPÍTULO I", "DISPOSIÇÕES GERAIS", "Art. 1º Um.", "(VETADO)", "Art. 2º Dois.", "NOTA: REDAÇÃO DADA PELA LEI Nº 13.853", "Art. 3º Três.", "SEÇÃO I", "(REVOGADA)", "Art. 4º Quatro."].join("\n");
    const r = splitLegalText(t)!;
    const names = r.units.flatMap((u) => [u.topic, u.subtopic ?? ""]).join("|");
    expect(names).not.toMatch(/vetad|revogad|nota/i);
    expect(r.units[0]!.topic).toBe("Disposições Gerais");
  });
});
