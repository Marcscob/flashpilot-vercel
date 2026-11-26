import { T } from "./i18n-ui";

export function webPageErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("WEB_INVALID_URL")) return T("Link de página da web inválido");
  return T(
    "Não foi possível ler esta página. Ela pode exigir login, estar bloqueada ou não ter texto. Tente outra ou cole o texto.",
  );
}

export const isWebPageError = (error: unknown): boolean =>
  (error instanceof Error ? error.message : String(error)).includes("WEB_");
