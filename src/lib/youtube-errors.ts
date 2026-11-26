import { T } from "./i18n-ui";

export function youtubeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("YOUTUBE_INVALID_URL")) return T("Link do YouTube inválido");
  if (message.includes("YOUTUBE_NO_CAPTIONS_TOO_LONG"))
    return T(
      "Este vídeo não tem legendas nem transcrição no YouTube e é longo demais para ser lido pelo áudio (limite de 60 minutos). Escolha um vídeo com legendas ou cole a transcrição como texto.",
    );
  if (message.includes("YOUTUBE_NO_STUDY_CONTENT"))
    return T(
      "Não encontramos conteúdo de estudo neste vídeo. Envie uma aula, explicação ou resumo.",
    );
  if (message.includes("YOUTUBE_NO_CAPTIONS"))
    return T(
      "Não foi possível usar este vídeo: ele não tem legendas nem transcrição no YouTube e não conseguimos ler o áudio. Escolha outro vídeo ou cole a transcrição como texto.",
    );
  if (message.includes("YOUTUBE_UNAVAILABLE"))
    return T(
      "Este vídeo não está disponível. Use um vídeo público, que não seja transmissão ao vivo.",
    );
  if (message.includes("YOUTUBE_TOO_LONG"))
    return T("A transcrição é muito longa. Escolha um vídeo mais curto.");
  return T("Não foi possível obter as legendas. Tente outro vídeo público do YouTube.");
}
