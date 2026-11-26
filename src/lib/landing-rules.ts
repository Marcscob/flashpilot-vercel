/** Public capture caps; paid generation remains authenticated and quota-controlled. */
export const LANDING_LIMITS = {
  cards: 10,
  fileBytes: 5 * 1024 * 1024,
  audioBytes: 6 * 1024 * 1024,
  textChars: 3000,
  /** Campo de texto principal da landing: contador em tempo real e bloqueio acima disso. */
  textFieldChars: 15_000,
  sheetRows: 500,
  recordingMs: 3 * 60 * 1000,
} as const;
export const LANDING_ECONOMY = {
  welcome: 40,
  monthly: 150,
  yearly: 300,
  validityMonths: 12,
  monthlyUsd: 4.99,
  yearlyUsd: 39.85,
} as const;

export const LANDING_LIMIT_ERROR = "landing_limit";
