// Browser-only note export (PDF / DOCX). Libraries load on demand so they never enter SSR.
type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
type Block = { kind: "h1" | "h2" | "h3" | "p" | "li" | "oli" | "quote"; runs: Run[]; num?: number };

export function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  const blocks: Block[] = [];
  const collect = (node: Node, fmt: Omit<Run, "text">, out: Run[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ");
      if (text) out.push({ text, ...fmt });
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    if (tag === "br") { out.push({ text: "\n", ...fmt }); return; }
    const f = { ...fmt };
    if (tag === "b" || tag === "strong") f.bold = true;
    if (tag === "i" || tag === "em") f.italic = true;
    if (tag === "u") f.underline = true;
    node.childNodes.forEach((c) => collect(c, f, out));
  };
  const push = (kind: Block["kind"], el: Element, num?: number) => {
    const runs: Run[] = [];
    el.childNodes.forEach((c) => {
      if (c instanceof Element && /^(ul|ol)$/i.test(c.tagName)) return;
      collect(c, {}, runs);
    });
    if (runs.some((r) => r.text.trim())) blocks.push({ kind, runs, num });
  };
  const walk = (el: Element) => {
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = (n.textContent ?? "").trim();
        if (t) blocks.push({ kind: "p", runs: [{ text: t }] });
        return;
      }
      if (!(n instanceof Element)) return;
      const tag = n.tagName.toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3") push(tag, n);
      else if (/^h[4-6]$/.test(tag)) push("h3", n);
      else if (tag === "ul" || tag === "ol") {
        let i = 0;
        Array.from(n.children).forEach((li) => {
          i++;
          push(tag === "ol" ? "oli" : "li", li, i);
          li.querySelectorAll(":scope > ul, :scope > ol").forEach((sub) => walk({ childNodes: [sub] } as unknown as Element));
        });
      } else if (tag === "blockquote") push("quote", n);
      else if (tag === "div" || tag === "section") walk(n);
      else push("p", n);
    });
  };
  walk(doc.body.firstElementChild as Element);
  return blocks;
}

function safeName(title: string) {
  return (title || "nota").replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "nota";
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function exportNotePdf(title: string, html: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 56;
  let y = M;
  const line = (text: string, size: number, style: string, indent = 0, gap = 6) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, W - M * 2 - indent) as string[];
    for (const l of lines) {
      if (y + size > H - M) { pdf.addPage(); y = M; }
      pdf.text(l, M + indent, y + size);
      y += size * 1.35;
    }
    y += gap;
  };
  line(title || "", 20, "bold", 0, 12);
  for (const b of htmlToBlocks(html)) {
    const text = b.runs.map((r) => r.text).join("").replace(/[ \t]+\n/g, "\n").trim();
    const allBold = b.runs.every((r) => !r.text.trim() || r.bold);
    if (b.kind === "h1") line(text, 16, "bold", 0, 8);
    else if (b.kind === "h2") line(text, 14, "bold", 0, 6);
    else if (b.kind === "h3") line(text, 12, "bold", 0, 4);
    else if (b.kind === "li") line(`•  ${text}`, 11, allBold ? "bold" : "normal", 12, 2);
    else if (b.kind === "oli") line(`${b.num}.  ${text}`, 11, allBold ? "bold" : "normal", 12, 2);
    else if (b.kind === "quote") line(text, 11, "italic", 18, 6);
    else line(text, 11, allBold ? "bold" : "normal", 0, 6);
  }
  download(pdf.output("blob"), `${safeName(title)}.pdf`);
}

export async function exportNoteDocx(title: string, html: string) {
  const d = await import("docx");
  const toRuns = (runs: Run[]) =>
    runs.flatMap((r) =>
      r.text.split("\n").map((part, i) =>
        new d.TextRun({ text: part, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined, break: i > 0 ? 1 : undefined }),
      ),
    );
  const children = [
    new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun({ text: title || "", bold: true })] }),
    ...htmlToBlocks(html).map((b) => {
      const runs = toRuns(b.runs);
      if (b.kind === "h1") return new d.Paragraph({ heading: d.HeadingLevel.HEADING_1, children: runs });
      if (b.kind === "h2") return new d.Paragraph({ heading: d.HeadingLevel.HEADING_2, children: runs });
      if (b.kind === "h3") return new d.Paragraph({ heading: d.HeadingLevel.HEADING_3, children: runs });
      if (b.kind === "li") return new d.Paragraph({ numbering: { reference: "bullets", level: 0 }, children: runs });
      if (b.kind === "oli") return new d.Paragraph({ numbering: { reference: "numbers", level: 0 }, children: runs });
      if (b.kind === "quote") return new d.Paragraph({ indent: { left: 720 }, children: runs.map((r) => r) });
      return new d.Paragraph({ spacing: { after: 120 }, children: runs });
    }),
  ];
  const doc = new d.Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: d.LevelFormat.BULLET, text: "•", alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: d.LevelFormat.DECIMAL, text: "%1.", alignment: d.AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }],
  });
  download(await d.Packer.toBlob(doc), `${safeName(title)}.docx`);
}
