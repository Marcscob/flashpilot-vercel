import { readTextFile } from "./decode-text";
/** Browser-only parsers are loaded on demand, never during SSR. */
export async function readDocumentText(
  file: File,
  maxChars: number,
  options: { truncate?: boolean; onTruncate?: () => void } = {},
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.size > 40 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 40 MB).");
  const checkLength = (text: string) => {
    if (text.length > maxChars && options.truncate) {
      options.onTruncate?.();
      return text.slice(0, maxChars);
    }
    if (text.length > maxChars) {
      throw new Error(
        `O documento excede o limite de ${maxChars.toLocaleString()} caracteres do seu plano.`,
      );
    }
    return text;
  };
  let text: string;
  if (extension === "txt" || extension === "md") {
    text = checkLength(await readTextFile(file));
  } else if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = checkLength(result.value);
  } else if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
    try {
      const document = await loadingTask.promise;
      const pages: string[] = [];
      let length = 0;
      for (let number = 1; number <= document.numPages; number++) {
        const page = await document.getPage(number);
        try {
          const content = await page.getTextContent();
          const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
          length += pageText.length + (number > 1 ? 2 : 0);
          pages.push(pageText);
          if (length > maxChars) {
            checkLength(" ".repeat(maxChars + 1));
            break;
          }
        } finally {
          page.cleanup();
        }
      }
      text = checkLength(pages.join("\n\n"));
    } finally {
      await loadingTask.destroy();
    }
  } else {
    throw new Error("Não foi possível ler o arquivo.");
  }
  if (!text.trim()) throw new Error("Não foi possível ler o arquivo.");
  return text.trim();
}
