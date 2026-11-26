import { describe, expect, test } from "bun:test";
import { structureSourceText } from "../src/lib/card-format";

describe("source sequence preservation", () => {
  test("keeps articles 1 through 6 and article subdivisions in source order", () => {
    const source = "Art. 1º - Anterioridade. Art. 2º - Lei penal no tempo. Parágrafo único - Lei favorável. Art. 3º - Lei temporária. Art. 4º - Tempo do crime. Art. 5º - Territorialidade. § 1º - Extensão. § 2º - Estrangeiras. Art. 6º - Lugar do crime.";
    const structured = structureSourceText(source);
    expect(Array.from(structured.matchAll(/Art\. (\d)º/g), (match) => Number(match[1]))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(structured.indexOf("Parágrafo único")).toBeGreaterThan(structured.indexOf("Art. 2º"));
    expect(structured.indexOf("Parágrafo único")).toBeLessThan(structured.indexOf("Art. 3º"));
    expect(structured.indexOf("§ 2º")).toBeLessThan(structured.indexOf("Art. 6º"));
  });

  test("retains presentation order instead of inventing numeric article order", () => {
    const structured = structureSourceText("Art. 6º - Primeiro trecho apresentado. Art. 2º - Segundo trecho apresentado.");
    expect(Array.from(structured.matchAll(/Art\. (\d)º/g), (match) => Number(match[1]))).toEqual([6, 2]);
  });
});