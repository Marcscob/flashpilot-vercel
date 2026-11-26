/** Limites de leitura de vídeos do YouTube: teste lê o início; assinante lê tudo, com aviso acima do limite de custo. */
export const YOUTUBE_TRIAL_CHARS = 30_000;
export const YOUTUBE_COST_WARN_CHARS = 100_000;

export function languageLabel(code: string, uiLang: string): string {
  try {
    return new Intl.DisplayNames([uiLang], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function needsTranslationChoice(videoLang: string | undefined, outputLang: string): boolean {
  const base = (code: string) => code.toLowerCase().split("-")[0];
  return Boolean(videoLang) && base(videoLang as string) !== base(outputLang);
}
