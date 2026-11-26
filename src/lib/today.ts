/**
 * Datas de revisão devem usar o fuso LOCAL do usuário, nunca UTC.
 * `toISOString()` converte para UTC e, no Brasil (UTC-3), a partir das 21h
 * já retorna o dia seguinte — inflando a contagem de cards pendentes.
 */

/** Converte um Date para "YYYY-MM-DD" no fuso local do dispositivo. */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Data de hoje ("YYYY-MM-DD") no fuso local do dispositivo. */
export function todayLocal(): string {
  return localDateStr(new Date());
}

/** Data de hoje no fuso de Brasília — use no servidor (que roda em UTC). */
export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
