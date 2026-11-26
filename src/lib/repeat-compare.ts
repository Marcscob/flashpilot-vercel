/**
 * Modo "Repita depois de mim" — comparação do que o aluno falou com a frase
 * proposta. É puro TypeScript (não gasta crédito do PilotAI) e ignora pontuação,
 * maiúsculas e acentos, porque o ditado não é confiável nesses detalhes.
 */

export type RepeatTokenStatus = "ok" | "wrong" | "missing" | "extra";

export type RepeatToken = {
  /** Palavra mostrada ao aluno (como escrita na frase, ou como foi falada). */
  text: string;
  status: RepeatTokenStatus;
};

export type RepeatComparison = {
  tokens: RepeatToken[];
  /** Porcentagem de acerto (0 a 100). */
  score: number;
};

/** Minúsculas, sem acento e sem pontuação — para comparar palavra a palavra. */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => normalizeWord(w).length > 0);
}

/**
 * Alinha as duas frases pela maior subsequência comum, para que uma palavra
 * a mais ou a menos não desalinhe todo o resto.
 */
export function compareRepeat(expected: string, spoken: string): RepeatComparison {
  const exp = tokenize(expected);
  const got = tokenize(spoken);
  const a = exp.map(normalizeWord);
  const b = got.map(normalizeWord);

  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const tokens: RepeatToken[] = [];
  let hits = 0;
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ text: exp[i]!, status: "ok" });
      hits += 1;
      i += 1;
      j += 1;
      continue;
    }
    // Palavra trocada: as duas avançam quando nenhuma delas reaparece adiante.
    if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      const substituted = lcs[i + 1]![j]! === lcs[i + 1]![j + 1]!;
      if (substituted) {
        tokens.push({ text: exp[i]!, status: "wrong" });
        i += 1;
        j += 1;
      } else {
        tokens.push({ text: exp[i]!, status: "missing" });
        i += 1;
      }
    } else {
      tokens.push({ text: got[j]!, status: "extra" });
      j += 1;
    }
  }
  while (i < n) {
    tokens.push({ text: exp[i]!, status: "missing" });
    i += 1;
  }
  while (j < m) {
    tokens.push({ text: got[j]!, status: "extra" });
    j += 1;
  }

  const score = n === 0 ? 0 : Math.round((hits / Math.max(n, m)) * 100);
  return { tokens, score };
}

/** Mensagem curta em português conforme o acerto. */
export function repeatFeedback(score: number): string {
  if (score >= 95) return "Perfeito!";
  if (score >= 80) return "Muito bom, quase igual.";
  if (score >= 55) return "Está no caminho; tente de novo com calma.";
  return "Ouça outra vez e repita devagar.";
}
