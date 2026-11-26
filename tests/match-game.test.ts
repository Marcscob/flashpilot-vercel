import { describe, expect, it } from "bun:test";
import {
  MATCH_ROUND_MAX,
  chunkIntoRounds,
  matchDraftSchema,
  normalizePairs,
  shuffledOrder,
  targetPairCount,
} from "../src/lib/match-game";

const pairs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ left: `Conceito ${i}`, right: `Explicação ${i}` }));

describe("FlashMatch: normalização de pares", () => {
  it("remove markdown, vazios, repetidos e pares com texto igual", () => {
    const result = normalizePairs([
      { left: "**Passado simples**", right: "Ação concluída no passado" },
      { left: "passado  simples", right: "Outra explicação" },
      { left: "Futuro", right: "Ação concluída no passado" },
      { left: "", right: "sem conceito" },
      { left: "Igual", right: "Igual" },
      { left: 1, right: "x" },
      null,
    ]);
    expect(result).toEqual([{ left: "Passado simples", right: "Ação concluída no passado" }]);
  });

  it("limita o tamanho dos textos sem cortar no meio da palavra", () => {
    const [p] = normalizePairs([{ left: "palavra ".repeat(30), right: "x".repeat(400) }]);
    expect(p!.left.length).toBeLessThanOrEqual(80);
    expect(p!.right.length).toBeLessThanOrEqual(160);
    expect(p!.left.endsWith("…")).toBe(true);
  });

  it("devolve lista vazia para entrada que não é lista", () => {
    expect(normalizePairs(undefined)).toEqual([]);
    expect(normalizePairs({})).toEqual([]);
  });
});

describe("FlashMatch: rodadas", () => {
  it("equilibra as rodadas entre 3 e 5 pares preservando ordem e total", () => {
    for (let n = 3; n <= 60; n++) {
      const rounds = chunkIntoRounds(pairs(n));
      const sizes = rounds.map((r) => r.pairs.length);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...sizes)).toBeLessThanOrEqual(MATCH_ROUND_MAX);
      expect(rounds.flatMap((r) => r.pairs)).toEqual(pairs(n));
    }
  });

  it("não cria rodada com menos de 3 pares", () => {
    expect(chunkIntoRounds(pairs(2))).toEqual([]);
    expect(chunkIntoRounds(pairs(11)).map((r) => r.pairs.length)).toEqual([4, 4, 3]);
  });

  it("pede entre 3 e 30 pares à IA, no máximo um por card", () => {
    expect(targetPairCount(1)).toBe(3);
    expect(targetPairCount(5)).toBe(5);
    expect(targetPairCount(12)).toBe(12);
    expect(targetPairCount(500)).toBe(30);
  });
});

describe("FlashMatch: embaralhamento", () => {
  it("é estável por semente e nunca mantém a ordem original", () => {
    for (let seed = 1; seed < 200; seed++) {
      for (const length of [2, 3, 4, 5]) {
        const a = shuffledOrder(length, seed);
        expect(a).toEqual(shuffledOrder(length, seed));
        expect([...a].sort()).toEqual(Array.from({ length }, (_, i) => i));
        expect(a.some((v, i) => v !== i)).toBe(true);
      }
    }
    expect(shuffledOrder(1, 7)).toEqual([0]);
  });
});

describe("FlashMatch: esquema de gravação", () => {
  it("aceita rodadas válidas e recusa rodada com 2 ou 6 pares", () => {
    const ok = { title: "Gramática", rounds: [{ pairs: pairs(5) }] };
    expect(matchDraftSchema.safeParse(ok).success).toBe(true);
    expect(matchDraftSchema.safeParse({ ...ok, rounds: [{ pairs: pairs(2) }] }).success).toBe(
      false,
    );
    expect(matchDraftSchema.safeParse({ ...ok, rounds: [{ pairs: pairs(6) }] }).success).toBe(
      false,
    );
  });
});
