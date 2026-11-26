import { localDateStr } from "@/lib/today";
// SM-2 spaced repetition algorithm (SuperMemo 2 by Piotr Wozniak)
// Quality: 0-5. 0-2 = errou. 3-5 = acertou.
// Teto escalonado por domínio:
//   - Padrão: 7 dias (revisão semanal).
//   - Após 10 acertos consecutivos: teto sobe para 15 dias.
//   - Após 25 acertos consecutivos: teto sobe para 30 dias ("dominado").
// Qualquer falha (quality < 3) reseta as repetições e o teto volta a 7 dias.

export const MAX_INTERVAL_DAYS = 7;
export const MAX_INTERVAL_MASTERED = 15;
export const MAX_INTERVAL_ABSOLUTE = 30;
export const MASTERED_THRESHOLD = 10;
export const ABSOLUTE_THRESHOLD = 25;

function firstCorrectInterval(quality: number): number {
  if (quality <= 3) return 2;
  if (quality === 4) return 4;
  return MAX_INTERVAL_DAYS;
}

function secondCorrectInterval(quality: number): number {
  if (quality <= 3) return 3;
  if (quality === 4) return 6;
  return MAX_INTERVAL_DAYS;
}

function qualityMultiplier(quality: number): number {
  if (quality <= 3) return 0.65;
  if (quality === 4) return 1;
  return 1.25;
}

function minimumGrowth(quality: number): number {
  if (quality <= 3) return 1;
  if (quality === 4) return 2;
  return 3;
}

export function capForRepetitions(repetitions: number): number {
  if (repetitions >= ABSOLUTE_THRESHOLD) return MAX_INTERVAL_ABSOLUTE;
  if (repetitions >= MASTERED_THRESHOLD) return MAX_INTERVAL_MASTERED;
  return MAX_INTERVAL_DAYS;
}

export type Sm2State = {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
};

export type Sm2Result = Sm2State & { due_date: string };

export function computeSm2(state: Sm2State, quality: number): Sm2Result {
  const q = Math.max(0, Math.min(5, quality));
  let { ease_factor, interval_days, repetitions } = state;

  if (q < 3) {
    // Errou → reinicia repetições e volta ao teto padrão
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = firstCorrectInterval(q);
    else if (repetitions === 1) interval_days = secondCorrectInterval(q);
    else {
      interval_days = Math.max(
        interval_days + minimumGrowth(q),
        Math.round(interval_days * ease_factor * qualityMultiplier(q)),
      );
    }
    repetitions += 1;
  }

  // Ajuste do fator de facilidade
  ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;

  // Teto escalonado conforme domínio do card
  const cap = capForRepetitions(repetitions);
  if (interval_days > cap) interval_days = cap;

  const due = new Date();
  due.setDate(due.getDate() + interval_days);
  const due_date = localDateStr(due);

  return { ease_factor, interval_days, repetitions, due_date };
}


// Traduz nome da qualidade para a UI
export const QUALITY_LABELS: Record<number, { label: string; hint: string; tone: string }> = {
  0: { label: "Não lembrei", hint: "Reaparece hoje", tone: "destructive" },
  3: { label: "Difícil", hint: "Curto intervalo", tone: "warning" },
  4: { label: "Bom", hint: "Intervalo normal", tone: "primary" },
  5: { label: "Fácil", hint: "Intervalo maior", tone: "success" },
};
