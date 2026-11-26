// EPUB 3 (Kindle/KDP + Send-to-Kindle compatible): nav.xhtml + toc.ncx,
// page breaks per chapter, relative font sizes, bidirectional exercise/answer links.
import type { Ebook } from "./ebook";
import { escapeHtml as e, chapterHeading, textToXhtml } from "./ebook";

const CSS = `body{font-family:serif;line-height:1.5;margin:0 1em}
h1{font-size:1.6em;break-before:page;page-break-before:always}
h2{font-size:1.3em;margin-top:1.4em}h3{font-size:1.1em}
pre{font-family:monospace;font-size:0.9em;white-space:pre-wrap;border:1px solid #888;background:#f5f5f5;color:#000;padding:0.6em}
figure{margin:1.5em auto;text-align:center}figure img{max-width:100%;height:auto;display:block;margin:0 auto;background:#fff;border:1px solid #e0e0e0}figure.mindmap{page-break-inside:avoid;break-inside:avoid}figure.mindmap img{max-width:85%;max-height:60vh;object-fit:contain}
figcaption{font-size:0.9em;font-style:italic}
.ex{margin:0.8em 0}.ex a,.ans a{font-size:0.85em}
nav ol{list-style:none;padding-left:1em}`;

const page = (title: string, lang: string, body: string, extra = "") => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${lang}" xml:lang="${lang}">
<head><meta charset="UTF-8"/><title>${e(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/>${extra}</head>
<body>${body}</body></html>`;

export function ebookFiles(book: Ebook, uuid: string, labels = { chapter: "Capítulo", toc: "Sumário", exercises: "Exercícios", key: "Gabarito comentado", toKey: "Ver gabarito", back: "Voltar ao exercício" }): Record<string, string> {
  const L = book.language;
  const files: Record<string, string> = {};
  const all = book.chapters.flatMap((c) => [...c.exercises, ...c.sections.flatMap((s) => s.exercises)]);
  const exHtml = (list: typeof all) => list.length ? `<h3>${labels.exercises}</h3>` + list.map((x) =>
    `<div class="ex" id="ex-${x.id}"><p><strong>${x.number}.</strong></p>${textToXhtml(x.question)}<p><a href="answers.xhtml#ans-${x.id}">${labels.toKey}</a></p></div>`).join("\n") : "";

  book.chapters.forEach((ch, i) => {
    const body = `<section epub:type="chapter" id="ch-${ch.id}"><h1>${e(chapterHeading(ch, labels.chapter))}</h1>${ch.html}${exHtml(ch.exercises)}
${ch.sections.map((s) => `<section id="s-${s.id}"><h2>${s.number} - ${e(s.title)}</h2>${s.html}${exHtml(s.exercises)}</section>`).join("\n")}</section>`;
    files[`OEBPS/ch${i + 1}.xhtml`] = page(ch.title, L, body);
  });
  files["OEBPS/answers.xhtml"] = page(labels.key, L, `<section epub:type="appendix"><h1>${labels.key}</h1>${all.map((x, idx) => {
    const ci = book.chapters.findIndex((c) => [...c.exercises, ...c.sections.flatMap((s) => s.exercises)].includes(x));
    return `<div class="ans" id="ans-${x.id}"><p><strong>${x.number}.</strong></p>${textToXhtml(x.answer)}<p><a href="ch${ci + 1}.xhtml#ex-${x.id}">${labels.back}</a></p></div>`;
  }).join("\n")}</section>`);

  const tocList = book.chapters.map((ch, i) => `<li><a href="ch${i + 1}.xhtml">${e(chapterHeading(ch, labels.chapter))}</a>${ch.sections.length ? `<ol>${ch.sections.map((s) => `<li><a href="ch${i + 1}.xhtml#s-${s.id}">${s.number} - ${e(s.title)}</a></li>`).join("")}</ol>` : ""}</li>`).join("\n")
    + `<li><a href="answers.xhtml">${labels.key}</a></li>`;
  files["OEBPS/nav.xhtml"] = page(labels.toc, L, `<nav epub:type="toc" id="toc"><h1>${labels.toc}</h1><ol>${tocList}</ol></nav>`);
  files["OEBPS/toc.xhtml"] = page(labels.toc, L, `<h1>${labels.toc}</h1><ol>${tocList}</ol>`);

  let po = 0;
  const np = (id: string, label: string, src: string, kids = "") => `<navPoint id="${id}" playOrder="${++po}"><navLabel><text>${e(label)}</text></navLabel><content src="${src}"/>${kids}</navPoint>`;
  const points = book.chapters.map((ch, i) => np(`n${i}`, chapterHeading(ch, labels.chapter), `ch${i + 1}.xhtml`, ch.sections.map((s) => np(`n${i}-${s.id}`, `${s.number} - ${s.title}`, `ch${i + 1}.xhtml#s-${s.id}`)).join(""))).join("") + np("nkey", labels.key, "answers.xhtml");
  files["OEBPS/toc.ncx"] = `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="urn:uuid:${uuid}"/></head><docTitle><text>${e(book.title)}</text></docTitle><navMap>${points}</navMap></ncx>`;
  files["OEBPS/style.css"] = CSS;

  const spine = ["toc", ...book.chapters.map((_, i) => `ch${i + 1}`), "answers"];
  files["OEBPS/content.opf"] = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="${L}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:${uuid}</dc:identifier><dc:title>${e(book.title)}</dc:title><dc:creator>FlashPilot</dc:creator><dc:language>${L}</dc:language><meta property="dcterms:modified">${new Date().toISOString().slice(0, 19)}Z</meta></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="style.css" media-type="text/css"/>
${spine.map((s) => `<item id="${s}" href="${s}.xhtml" media-type="application/xhtml+xml"/>`).join("\n")}</manifest>
<spine toc="ncx">${spine.map((s) => `<itemref idref="${s}"/>`).join("")}</spine>
<guide><reference type="toc" title="${labels.toc}" href="toc.xhtml"/></guide></package>`;
  files["META-INF/container.xml"] = `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
  return files;
}

/** Builds the .epub blob; mimetype is stored uncompressed and first, as OCF requires. */
export async function buildEpubBlob(book: Ebook, loadImage?: (path: string) => Promise<Blob | null>): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  const files = ebookFiles(book, crypto.randomUUID());
  const items: string[] = [];
  const names = new Map<string, string>();
  for (const [p, c] of Object.entries(files)) {
    if (!p.endsWith(".xhtml")) continue;
    for (const m of c.matchAll(/src="ebook-img:([^"]+)"/g)) {
      const path = m[1] as string;
      if (names.has(path)) continue;
      const blob = loadImage ? await loadImage(path) : null;
      if (!blob) { names.set(path, ""); continue; }
      const name = `images/img${names.size + 1}.jpg`;
      names.set(path, name);
      zip.file(`OEBPS/${name}`, blob);
      items.push(`<item id="img${items.length + 1}" href="${name}" media-type="image/jpeg"/>`);
    }
  }
  for (const [p, c] of Object.entries(files)) {
    let out = c.replace(/<figure(?: class="mindmap")?><img src="ebook-img:([^"]+)"[^>]*\/>(?:<figcaption>[\s\S]*?<\/figcaption>)?<\/figure>/g, (all, path: string) =>
      names.get(path) ? all.replace(`ebook-img:${path}`, names.get(path) as string) : "");
    if (p.endsWith("content.opf")) out = out.replace("</manifest>", `${items.join("\n")}</manifest>`);
    zip.file(p, out);
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/epub+zip", compression: "DEFLATE" });
}
