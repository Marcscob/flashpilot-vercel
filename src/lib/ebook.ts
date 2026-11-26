// Browser-safe e-book model: chapters/sections numbered hierarchically,
// flashcards as exercises with answers only in the final answer key.

export type EbookTopic = { id: string; name: string; parent_id: string | null; order_index: number | null; created_at: string };
export type EbookBlock = { id: string; topic_id: string; title: string; content: string; order_index: number | null; created_at: string; mindmap?: { path: string; title: string } | null };
export type EbookCard = { id: string; topic_id: string; microcontext_id: string | null; question: string; answer: string; order_index: number | null; created_at: string };

export type EbookExercise = { id: string; number: string; question: string; answer: string };
export type EbookSection = { id: string; kind: "topic" | "block"; number: string; title: string; html: string; exercises: EbookExercise[] };
export type EbookChapter = { id: string; number: string; title: string; html: string; sections: EbookSection[]; exercises: EbookExercise[] };
export type Ebook = { title: string; language: string; chapters: EbookChapter[] };

const byOrder = <T extends { order_index: number | null; created_at: string }>(a: T, b: T) =>
  (a.order_index ?? 1e9) - (b.order_index ?? 1e9) || a.created_at.localeCompare(b.created_at);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Image paragraph token stored in block text: [[img:storage/path.jpg|caption]] */
export const IMG_TOKEN = /^\[\[img:([^|\]]+)(?:\|([^\]]*))?\]\]$/;
export const imageToken = (path: string, caption: string) => `[[img:${path}|${caption.replace(/[|\]]/g, " ")}]]`;
/** Storage paths referenced by rendered image tags. */
export const imagePaths = (html: string) => [...html.matchAll(/src="ebook-img:([^"]+)"/g)].map((m) => m[1] as string);

/** Plain text -> semantic XHTML paragraphs; "Exemplo:" code-like lines become <pre><code>. */
export function textToXhtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const img = p.match(IMG_TOKEN);
      if (img) return `<figure><img src="ebook-img:${escapeHtml(img[1] ?? "")}" alt="${escapeHtml(img[2] ?? "")}"/>${img[2] ? `<figcaption>${escapeHtml(img[2])}</figcaption>` : ""}</figure>`;
      return (/[{};=()]|^\s*(def|function|const|let|class|import|print)\b/m.test(p) && p.includes("\n")
      ? `<pre><code>${escapeHtml(p)}</code></pre>`
      : `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`);
    })
    .join("\n");
}

/** Mind map figure placed right below its microcontext text. */
const blockHtml = (b: EbookBlock) => textToXhtml(b.content) + (b.mindmap?.path
  ? `\n<figure class="mindmap"><img src="ebook-img:${escapeHtml(b.mindmap.path)}" alt="${escapeHtml(b.mindmap.title)}"/><figcaption>${escapeHtml(b.mindmap.title)}</figcaption></figure>`
  : "");

export function buildEbook(title: string, language: string, topics: EbookTopic[], blocks: EbookBlock[], cards: EbookCard[]): Ebook {
  const roots = topics.filter((t) => !t.parent_id).sort(byOrder);
  const childrenOf = (id: string) => topics.filter((t) => t.parent_id === id).sort(byOrder);
  const blocksOf = (id: string) => blocks.filter((b) => b.topic_id === id).sort(byOrder);
  const sorted = [...cards].sort(byOrder);
  const ex = (pred: (c: EbookCard) => boolean) =>
    sorted.filter(pred).map((c) => ({ id: c.id, number: "", question: c.question, answer: c.answer }));
  const blockIds = new Set(blocks.map((b) => b.id));

  const chapters: EbookChapter[] = roots.map((root) => {
    // Blocks and child topics share one ordering space so cross-type moves persist.
    const items: { o: { order_index: number | null; created_at: string }; s: EbookSection }[] = [];
    for (const b of blocksOf(root.id)) items.push({ o: b, s: { id: b.id, kind: "block", number: "", title: b.title, html: blockHtml(b), exercises: ex((c) => c.microcontext_id === b.id) } });
    for (const child of childrenOf(root.id)) {
      const html = blocksOf(child.id).map((b) => `<h3>${escapeHtml(b.title)}</h3>\n${blockHtml(b)}`).join("\n");
      const childBlockIds = new Set(blocksOf(child.id).map((b) => b.id));
      items.push({ o: child, s: { id: child.id, kind: "topic", number: "", title: child.name, html, exercises: ex((c) => c.topic_id === child.id || (!!c.microcontext_id && childBlockIds.has(c.microcontext_id))) } });
    }
    const sections = items.sort((a, b) => byOrder(a.o, b.o)).map((x) => x.s);
    const loose = ex((c) => c.topic_id === root.id && (!c.microcontext_id || !blockIds.has(c.microcontext_id)));
    // Cards without a microcontext join the last section so exercises always follow a text block.
    const last = sections[sections.length - 1];
    if (last && loose.length) { last.exercises = [...last.exercises, ...loose]; loose.length = 0; }
    return { id: root.id, number: "", title: root.name, html: "", sections, exercises: loose };
  });
  return renumber({ title, language, chapters });
}

/** Hierarchical numbering: chapter "1", sections "1.1", exercises "1.1.3" / "1.E2". */
export function renumber(book: Ebook): Ebook {
  return {
    ...book,
    chapters: book.chapters.map((ch, i) => {
      const n = String(i + 1);
      return {
        ...ch,
        number: n,
        exercises: ch.exercises.map((e, k) => ({ ...e, number: `${n}.E${k + 1}` })),
        sections: ch.sections.map((s, j) => {
          const sn = `${n}.${j + 1}`;
          return { ...s, number: sn, exercises: s.exercises.map((e, k) => ({ ...e, number: `${sn}.${k + 1}` })) };
        }),
      };
    }),
  };
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function moveChapter(book: Ebook, from: number, to: number): Ebook {
  return renumber({ ...book, chapters: move(book.chapters, from, to) });
}

export function moveSection(book: Ebook, chapterId: string, from: number, to: number): Ebook {
  return renumber({ ...book, chapters: book.chapters.map((c) => (c.id === chapterId ? { ...c, sections: move(c.sections, from, to) } : c)) });
}

/** Moves a section to any position of any chapter (same or another). */
export function moveSectionTo(book: Ebook, fromChapterId: string, from: number, toChapterId: string, to: number): Ebook {
  if (fromChapterId === toChapterId) return moveSection(book, fromChapterId, from, to);
  const source = book.chapters.find((c) => c.id === fromChapterId);
  const item = source?.sections[from];
  if (!item || !book.chapters.some((c) => c.id === toChapterId)) return book;
  return renumber({ ...book, chapters: book.chapters.map((c) => {
    if (c.id === fromChapterId) return { ...c, sections: c.sections.filter((_, i) => i !== from) };
    if (c.id !== toChapterId) return c;
    const next = [...c.sections];
    next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
    return { ...c, sections: next };
  }) });
}

/** Removes a chapter, section or exercise; numbering closes the gap. */
export function removeFromEbook(book: Ebook, id: string): Ebook {
  const keep = (e: EbookExercise) => e.id !== id;
  return renumber({ ...book, chapters: book.chapters.filter((c) => c.id !== id).map((c) => ({
    ...c, exercises: c.exercises.filter(keep),
    sections: c.sections.filter((s) => s.id !== id).map((s) => ({ ...s, exercises: s.exercises.filter(keep) })),
  })) });
}

export function chapterHeading(ch: EbookChapter, label = "Capítulo"): string {
  return `${label} ${ch.number} - ${ch.title}`;
}
