/**
 * Desenho determinístico do mapa mental num PNG.
 *
 * O PilotAI só devolve a árvore de tópicos; o desenho é feito aqui, no navegador,
 * para o texto sair sempre nítido e legível (ao contrário de uma imagem
 * gerada por modelo de imagem).
 */
export type MindMapNode = { label: string; children?: MindMapNode[] };
export type MindMapTree = { title: string; lang?: string; nodes: MindMapNode[] };

const SCALE = 2;
const MARGIN = 48;
const COL_GAP = 64;
const ROW_GAP = 14;
const PAD_X = 14;
const PAD_Y = 10;
const LINE = 20;

const COLORS = {
  bg: "#ffffff",
  root: "#1f2a44",
  rootText: "#ffffff",
  branch: ["#2563eb", "#0d9488", "#c2410c", "#7c3aed", "#b91c1c", "#0369a1", "#4d7c0f", "#a16207"],
  leafBg: "#f5f7fb",
  leafText: "#1f2937",
  line: "#c9d2e0",
  watermark: "#94a3b8",
};

type Box = {
  label: string;
  lines: string[];
  depth: number;
  color: string;
  w: number;
  h: number;
  x: number;
  y: number;
  children: Box[];
};

function widthFor(depth: number): number {
  if (depth === 0) return 260;
  if (depth === 1) return 230;
  return 210;
}

function fontFor(depth: number): string {
  if (depth === 0) return "700 20px system-ui, -apple-system, Segoe UI, sans-serif";
  if (depth === 1) return "600 16px system-ui, -apple-system, Segoe UI, sans-serif";
  return "400 14px system-ui, -apple-system, Segoe UI, sans-serif";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines.slice(0, 4) : [text];
}

function buildBox(
  ctx: CanvasRenderingContext2D,
  node: MindMapNode,
  depth: number,
  color: string,
): Box {
  const width = widthFor(depth);
  ctx.font = fontFor(depth);
  const lines = wrap(ctx, node.label, width - PAD_X * 2);
  const children = (node.children ?? []).map((child, i) =>
    buildBox(ctx, child, depth + 1, depth === 0 ? COLORS.branch[i % COLORS.branch.length]! : color),
  );
  return {
    label: node.label,
    lines,
    depth,
    color,
    w: width,
    h: lines.length * LINE + PAD_Y * 2,
    x: 0,
    y: 0,
    children,
  };
}

function subtreeHeight(box: Box): number {
  if (!box.children.length) return box.h;
  const inner = box.children.reduce((sum, c) => sum + subtreeHeight(c), 0)
    + ROW_GAP * (box.children.length - 1);
  return Math.max(box.h, inner);
}

function place(box: Box, x: number, top: number): void {
  const height = subtreeHeight(box);
  box.x = x;
  box.y = top + (height - box.h) / 2;
  let childTop = top + (height - (box.children.reduce((s, c) => s + subtreeHeight(c), 0)
    + ROW_GAP * Math.max(0, box.children.length - 1))) / 2;
  for (const child of box.children) {
    place(child, x + box.w + COL_GAP, childTop);
    childTop += subtreeHeight(child) + ROW_GAP;
  }
}

function extent(box: Box, acc: { right: number; bottom: number }): void {
  acc.right = Math.max(acc.right, box.x + box.w);
  acc.bottom = Math.max(acc.bottom, box.y + box.h);
  box.children.forEach((c) => extent(c, acc));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function draw(ctx: CanvasRenderingContext2D, box: Box): void {
  for (const child of box.children) {
    const x1 = box.x + box.w;
    const y1 = box.y + box.h / 2;
    const x2 = child.x;
    const y2 = child.y + child.h / 2;
    ctx.strokeStyle = box.depth === 0 ? child.color : COLORS.line;
    ctx.lineWidth = box.depth === 0 ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + COL_GAP / 2, y1, x2 - COL_GAP / 2, y2, x2, y2);
    ctx.stroke();
    draw(ctx, child);
  }

  const isRoot = box.depth === 0;
  const isBranch = box.depth === 1;
  roundRect(ctx, box.x, box.y, box.w, box.h, 12);
  ctx.fillStyle = isRoot ? COLORS.root : isBranch ? box.color : COLORS.leafBg;
  ctx.fill();
  if (!isRoot && !isBranch) {
    ctx.strokeStyle = box.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.font = fontFor(box.depth);
  ctx.fillStyle = isRoot ? COLORS.rootText : isBranch ? "#ffffff" : COLORS.leafText;
  ctx.textBaseline = "middle";
  const startY = box.y + PAD_Y + LINE / 2;
  box.lines.forEach((line, i) => {
    ctx.fillText(line, box.x + PAD_X, startY + i * LINE);
  });
}

/** Desenha a árvore e devolve o PNG pronto para envio/visualização. */
export async function renderMindMapPng(tree: MindMapTree): Promise<Blob> {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Não foi possível desenhar o mapa mental neste navegador.");

  const root = buildBox(measure, { label: tree.title, children: tree.nodes }, 0, COLORS.root);
  place(root, MARGIN, MARGIN);
  const acc = { right: 0, bottom: 0 };
  extent(root, acc);

  const width = Math.ceil(acc.right + MARGIN);
  const height = Math.ceil(acc.bottom + MARGIN + 24);

  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível desenhar o mapa mental neste navegador.");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  draw(ctx, root);

  ctx.font = "500 12px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillStyle = COLORS.watermark;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("FlashPilot", MARGIN, height - 16);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar a imagem do mapa mental."));
    }, "image/png");
  });
}
