/**
 * Gerador de cards visuais para redes sociais (Instagram, Facebook, X) usando HTML5 Canvas.
 * Desenha a imagem de capa do post com gradiente cinematográfico e sobrepõe o título
 * traduzido, selo da marca FlashPilot e o identificador da conta (@flashpilot.br, etc.).
 */

export type SocialCardOptions = {
  coverUrl?: string | null;
  title: string;
  /** Resumo com termos-chave e ideias centrais a estampar no card */
  subtitle?: string | null;
  accountHandle: string;
  badge?: string;
  width?: number;
  height?: number;
};

/**
 * Quebra o texto em linhas respeitando a largura máxima disponível no canvas.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Carrega a imagem com tratamento CORS para não contaminar o canvas.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem para o card."));
    img.src = url;
  });
}

/**
 * Gera um card quadrado 1080x1080 (ideal para Instagram) ou retangular
 * e devolve como data URL JPEG.
 */
export async function renderSocialCardDataUrl(
  options: SocialCardOptions,
): Promise<string> {
  const width = options.width ?? 1080;
  const height = options.height ?? 1080;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context não suportado.");

  // 1. Fundo: Imagem de capa ou gradiente moderno da marca
  let imageLoaded = false;
  if (options.coverUrl) {
    try {
      const img = await loadImage(options.coverUrl);
      // Center-crop (cover fit)
      const scale = Math.max(width / img.width, height / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;
      const x = (width - scaledW) / 2;
      const y = (height - scaledH) / 2;
      ctx.drawImage(img, x, y, scaledW, scaledH);
      imageLoaded = true;
    } catch {
      imageLoaded = false;
    }
  }

  if (!imageLoaded) {
    // Gradiente escuro elegante FlashPilot
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, "#0F172A");
    bgGradient.addColorStop(0.5, "#1E1B4B");
    bgGradient.addColorStop(1, "#090D16");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Sobreposição de gradiente de alto contraste para legibilidade impecável
  const overlayGradient = ctx.createLinearGradient(0, 0, 0, height);
  overlayGradient.addColorStop(0, "rgba(10, 15, 29, 0.45)");
  overlayGradient.addColorStop(0.35, "rgba(10, 15, 29, 0.2)");
  overlayGradient.addColorStop(0.6, "rgba(10, 15, 29, 0.75)");
  overlayGradient.addColorStop(1, "rgba(8, 12, 22, 0.96)");
  ctx.fillStyle = overlayGradient;
  ctx.fillRect(0, 0, width, height);

  // 3. Moldura sutil interna / estética editorial
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  // 4. Selo Superior FlashPilot
  const badgeText = (options.badge ?? "FLASHPILOT • ESTUDOS & MEMORIZAÇÃO").toUpperCase();
  ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const badgeMetrics = ctx.measureText(badgeText);
  const badgePadX = 24;
  const badgePadY = 12;
  const badgeW = badgeMetrics.width + badgePadX * 2;
  const badgeH = 24 + badgePadY * 2;
  const badgeX = 80;
  const badgeY = 80;

  // Fundo do selo translúcido com borda acentuada
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(99, 102, 241, 0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Texto do selo
  ctx.fillStyle = "#A5B4FC";
  ctx.fillText(badgeText, badgeX + badgePadX, badgeY + badgePadY + 18);

  // 5. Título do Artigo em Tipografia de Destaque
  const maxContentWidth = width - 160;
  const hasSubtitle = Boolean(options.subtitle?.trim());
  const cleanSubtitle = (options.subtitle ?? "").trim();

  let titleFontSize = hasSubtitle ? 50 : 64;
  ctx.font = `bold ${titleFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  let titleLines = wrapText(ctx, options.title, maxContentWidth);

  while (titleLines.length > (hasSubtitle ? 3 : 4) && titleFontSize > 36) {
    titleFontSize -= 3;
    ctx.font = `bold ${titleFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    titleLines = wrapText(ctx, options.title, maxContentWidth);
  }

  const titleLineHeight = titleFontSize * 1.25;
  const totalTitleHeight = titleLines.length * titleLineHeight;

  // Subtítulo / Resumo com termos-chave
  let subtitleFontSize = 28;
  let subtitleLines: string[] = [];
  let subtitleLineHeight = subtitleFontSize * 1.4;
  let totalSubtitleHeight = 0;

  if (hasSubtitle) {
    ctx.font = `500 ${subtitleFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    subtitleLines = wrapText(ctx, cleanSubtitle, maxContentWidth);
    if (subtitleLines.length > 3) {
      subtitleLines = subtitleLines.slice(0, 3);
      subtitleLines[2] = `${subtitleLines[2]?.replace(/[.,;:\s]+$/, "")}…`;
    }
    totalSubtitleHeight = subtitleLines.length * subtitleLineHeight + 20; // 20px margin top
  }

  const totalContentHeight = totalTitleHeight + totalSubtitleHeight;
  const startY = height - 160 - totalContentHeight;

  // Sombra suave para destacar o texto
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  // Renderiza Título
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${titleFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  titleLines.forEach((line, i) => {
    ctx.fillText(line, 80, startY + i * titleLineHeight);
  });

  // Renderiza Resumo / Ideias centrais
  if (hasSubtitle && subtitleLines.length) {
    ctx.fillStyle = "#E2E8F0";
    ctx.font = `500 ${subtitleFontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    const subStartY = startY + totalTitleHeight + 20;
    subtitleLines.forEach((line, i) => {
      ctx.fillText(line, 80, subStartY + i * subtitleLineHeight);
    });
  }

  // Limpa sombra
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // 6. Linha decorativa
  const lineY = height - 120;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(80, lineY);
  ctx.lineTo(width - 80, lineY);
  ctx.stroke();

  // 7. Rodapé: flashpilot.net | @flashpilot.xx
  ctx.font = "600 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText("flashpilot.net", 80, height - 70);

  ctx.fillStyle = "#38BDF8";
  const handleText = options.accountHandle.startsWith("@")
    ? options.accountHandle
    : `@${options.accountHandle}`;
  const handleMetrics = ctx.measureText(handleText);
  ctx.fillText(handleText, width - 80 - handleMetrics.width, height - 70);

  return canvas.toDataURL("image/jpeg", 0.92);
}
