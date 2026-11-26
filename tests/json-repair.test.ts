import { describe, expect, it } from "bun:test";
import { parseJsonLenient, repairJsonEscapes } from "../src/lib/json-repair";

describe("reparo de JSON de modelos", () => {
  it("troca barra + espaço por quebra de linha nas alternativas", () => {
    const raw = '{"cards":[{"question":"Qual?\\na) Norte\\ b) Sul\\nc) Leste","answer":"b"}]}';
    expect(() => JSON.parse(raw)).toThrow();
    const parsed = parseJsonLenient(raw) as { cards: Array<{ question: string }> };
    expect(parsed.cards[0]!.question).toBe("Qual?\na) Norte\nb) Sul\nc) Leste");
  });

  it("preserva escapes válidos, barras escapadas e unicode", () => {
    const valid = '{"a":"x\\\\ y","b":"linha\\nnova","c":"\\u00e9","d":"aspas \\" ok","e":"a\\/b"}';
    expect(repairJsonEscapes(valid)).toBe(valid);
    expect(parseJsonLenient(valid)).toEqual({
      a: "x\\ y",
      b: "linha\nnova",
      c: "é",
      d: 'aspas " ok',
      e: "a/b",
    });
  });

  it("descarta barras inválidas e extrai o objeto de texto ao redor", () => {
    expect(parseJsonLenient('Resposta: {"a":"1\\.5 kg"} fim')).toEqual({ a: "1.5 kg" });
  });

  it("devolve undefined quando não há JSON utilizável", () => {
    expect(parseJsonLenient("")).toBeUndefined();
    expect(parseJsonLenient('{"a": ')).toBeUndefined();
  });
});
