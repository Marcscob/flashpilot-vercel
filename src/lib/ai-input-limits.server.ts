import { AiQuotaPreflightError } from "./ai-quota.server";

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,/i;

function dataUrlBytes(value: string): number {
  const separator = value.indexOf(",");
  if (separator < 0 || !IMAGE_DATA_URL.test(value.slice(0, separator + 1))) {
    throw new AiQuotaPreflightError("Formato de imagem inválido.");
  }
  const payload = value.slice(separator + 1);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    throw new AiQuotaPreflightError("Conteúdo de imagem inválido.");
  }
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
}

export function validateAiImages(images: string[], isPro: boolean): void {
  const maxCount = isPro ? 20 : 8;
  const maxImageBytes = isPro ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  const maxTotalBytes = isPro ? 100 * 1024 * 1024 : 25 * 1024 * 1024;

  if (images.length > maxCount) {
    throw new AiQuotaPreflightError(`Seu plano permite até ${maxCount} imagens por envio.`);
  }

  let totalBytes = 0;
  for (const image of images) {
    const bytes = dataUrlBytes(image);
    if (bytes > maxImageBytes) {
      throw new AiQuotaPreflightError(
        `Cada imagem pode ter no máximo ${Math.floor(maxImageBytes / (1024 * 1024))} MB.`,
      );
    }
    totalBytes += bytes;
  }

  if (totalBytes > maxTotalBytes) {
    throw new AiQuotaPreflightError(
      `O conjunto de imagens pode ter no máximo ${Math.floor(maxTotalBytes / (1024 * 1024))} MB.`,
    );
  }
}

export async function validateAiPdf(dataUrl: string | undefined, isPro: boolean): Promise<void> {
  if (!dataUrl) return;
  const maxBytes = isPro ? 50 * 1024 * 1024 : 15 * 1024 * 1024;
  const prefix = "data:application/pdf;base64,";
  if (!dataUrl.startsWith(prefix)) {
    throw new AiQuotaPreflightError("Formato de PDF inválido.");
  }
  const payload = dataUrl.slice(prefix.length);
  if (!payload || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    throw new AiQuotaPreflightError("Conteúdo do PDF inválido.");
  }
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((payload.length * 3) / 4) - padding;
  if (bytes > maxBytes) {
    throw new AiQuotaPreflightError(
      `O PDF pode ter no máximo ${Math.floor(maxBytes / (1024 * 1024))} MB no seu plano.`,
    );
  }

  const maxPages = isPro ? 60 : 10;
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(Buffer.from(payload, "base64")),
    disableFontFace: true,
    useSystemFonts: false,
  });
  try {
    const pdf = await loadingTask.promise;
    if (pdf.numPages > maxPages) {
      throw new AiQuotaPreflightError(
        `O PDF pode ter no máximo ${maxPages} páginas no seu plano.`,
      );
    }
  } catch (error) {
    if (error instanceof AiQuotaPreflightError) throw error;
    throw new AiQuotaPreflightError("Não foi possível validar o PDF. Envie um arquivo PDF válido e sem senha.");
  } finally {
    await loadingTask.destroy();
  }
}
