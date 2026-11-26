import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import notoRegularUrl from "@/assets/fonts/NotoSans-Regular.ttf?url";
import notoBoldUrl from "@/assets/fonts/NotoSans-Bold.ttf?url";
import { getUiLang, T } from "@/lib/i18n-ui";

/** Fonte UTF-8 embutida: garante ç, ã, é, ü, ñ, ß etc. sem caracteres quebrados. */
const PDF_FONT = "NotoSans";
let fontCache: { regular: string; bold: string } | null = null;

async function fetchFontBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font ${url}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Registra a fonte no documento; em caso de falha mantém a fonte padrão. */
async function registerUnicodeFont(doc: jsPDF): Promise<boolean> {
  try {
    if (!fontCache) {
      const [regular, bold] = await Promise.all([
        fetchFontBase64(notoRegularUrl),
        fetchFontBase64(notoBoldUrl),
      ]);
      fontCache = { regular, bold };
    }
    doc.addFileToVFS("NotoSans-Regular.ttf", fontCache.regular);
    doc.addFont("NotoSans-Regular.ttf", PDF_FONT, "normal");
    doc.addFileToVFS("NotoSans-Bold.ttf", fontCache.bold);
    doc.addFont("NotoSans-Bold.ttf", PDF_FONT, "bold");
    doc.setFont(PDF_FONT, "normal");
    return true;
  } catch {
    return false;
  }
}

export type ReportFilter = { label: string; value: string };

type BuildArgs = {
  /** Cabeçalho das colunas, na ordem. */
  head: string[];
  /** Linhas já na ordem exibida na tela. */
  body: string[][];
  /** Filtros aplicados, mostrados abaixo do título. */
  filters: ReportFilter[];
  /** Nome do arquivo, sem extensão. */
  fileName: string;
  title?: string;
  /** Larguras fixas por índice de coluna (mm). */
  columnStyles?: Record<number, { cellWidth: number }>;
  locale?: string;
  labels?: {
    generatedAt: string;
    card: string;
    cards: string;
    page: string;
    of: string;
    footer: string;
  };
};

/** Carrega o logotipo como data URL para desenhar no PDF (falha silenciosa). */
async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/flashpilot-logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Relatório profissional de flash cards: logotipo, título, filtros aplicados,
 * marca d'água "Flash Pilot" em todas as páginas e numeração no rodapé.
 */
export async function exportFlashcardsReportPdf({
  head,
  body,
  filters,
  fileName,
  title = T("Relatório de Flash Cards"),
  columnStyles,
  locale = getUiLang(),
  labels = {
    generatedAt: T("Gerado em"),
    card: T("flashcard"),
    cards: T("flashcards"),
    page: T("Página"),
    of: T("de"),
    footer: "FlashPilot",
  },
}: BuildArgs) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const logo = await loadLogo();
  const unicodeFont = await registerUnicodeFont(doc);
  const fontName = unicodeFont ? PDF_FONT : "helvetica";

  const generatedAt = new Date().toLocaleString(locale);
  const filterLines: string[] = [];
  const active = filters.filter((f) => f.value && f.value.trim() !== "");
  for (let i = 0; i < active.length; i += 3) {
    filterLines.push(
      active
        .slice(i, i + 3)
        .map((f) => `${f.label}: ${f.value}`)
        .join("    ·    "),
    );
  }

  const headerHeight = 30 + filterLines.length * 4.5;

  function drawDecorations() {
    doc.setFont(fontName, "normal");
    // Marca d'água diagonal, discreta para não prejudicar a leitura.
    doc.saveGraphicsState();
    // @ts-expect-error GState existe no runtime do jsPDF
    doc.setGState(new doc.GState({ opacity: 0.07 }));
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(64);
    doc.text("Flash Pilot", pageW / 2, pageH / 2, { align: "center", angle: 28 });
    doc.restoreGraphicsState();

    // Cabeçalho
    if (logo) {
      try {
        // Mantém a proporção do canvas original (1650 × 1214) para não achatar a marca.
        const logoWidth = 27;
        const logoHeight = logoWidth * (1214 / 1650);
        doc.addImage(logo, "PNG", 12, 4, logoWidth, logoHeight);
      } catch {
        /* ignora logotipo inválido */
      }
    }
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(15);
    doc.text(title, logo ? 43 : 12, 15);
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(`${labels.generatedAt} ${generatedAt}`, pageW - 12, 12, { align: "right" });
    doc.text(`${body.length} ${body.length === 1 ? labels.card : labels.cards}`, pageW - 12, 16.5, {
      align: "right",
    });

    let y = 24;
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    for (const line of filterLines) {
      doc.text(line, logo ? 43 : 12, y);
      y += 4.5;
    }
    doc.setDrawColor(200, 200, 200);
    doc.line(12, headerHeight - 3, pageW - 12, headerHeight - 3);
  }

  autoTable(doc, {
    startY: headerHeight,
    margin: { top: headerHeight, bottom: 16, left: 12, right: 12 },
    head: [head],
    body,
    styles: {
      font: fontName,
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      textColor: [30, 30, 30],
    },
    headStyles: {
      font: fontName,
      fillColor: [24, 37, 56],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 246, 248] },
    columnStyles,
    didDrawPage: () => {
      drawDecorations();
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(labels.footer, 12, pageH - 8);
      doc.text(`${labels.page} ${page}`, pageW - 12, pageH - 8, { align: "right" });
    },
  });

  // Renumera o rodapé com o total de páginas já conhecido.
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(255, 255, 255);
    doc.rect(pageW - 50, pageH - 12, 38, 6, "F");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${labels.page} ${i} ${labels.of} ${total}`, pageW - 12, pageH - 8, {
      align: "right",
    });
  }

  doc.save(`${fileName}.pdf`);
}
