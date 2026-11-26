import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, BookOpen, Download, ImagePlus, Loader2, Pencil, Printer, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SpeakButton } from "@/components/SpeakButton";
import { htmlToPlainText } from "@/lib/tts";
import { ebookNarration } from "@/lib/ebook-narration";
import { pageHead } from "@/lib/page-head";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { canEditEbook, ebookEditKey, type EbookEditTarget } from "@/lib/ebook-edit";
import { buildEbook, chapterHeading, imagePaths, imageToken, moveChapter, moveSection, moveSectionTo, removeFromEbook, textToXhtml, type Ebook, type EbookExercise } from "@/lib/ebook";

export const Route = createFileRoute("/_authenticated/ebook/$subjectId")({
  component: EbookPage,
  head: () => pageHead("Editor do PilotE-book | FlashPilot", "Edite, ouça, reorganize e exporte o PilotE-book da sua matéria em EPUB (Kindle) e PDF."),
});

function EbookPage() {
  const { subjectId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ebook", subjectId],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: subj, error: subjectError } = await supabase.from("subjects").select("name, user_id").eq("id", subjectId).single();
      if (subjectError) throw subjectError;
      const { data: topics, error: topicError } = await supabase.from("topics").select("id, name, parent_id, order_index, created_at, user_id").eq("subject_id", subjectId);
      if (topicError) throw topicError;
      const identity = { userId: auth.user?.id, owner: subj.user_id };
      const ids = (topics ?? []).map((t) => t.id);
      if (!ids.length) return { ...identity, name: subj.name, topics: [], blocks: [], cards: [] };
      const [blocks, cards] = await Promise.all([
        fetchAllPages(ids, (part, from, to) => supabase.from("microcontexts").select("id, topic_id, title, content, order_index, created_at, user_id, mindmap_data, reviewed_at").in("topic_id", part).order("id").range(from, to)),
        fetchAllPages(ids, (part, from, to) => supabase.from("flashcards").select("id, topic_id, microcontext_id, question, answer, order_index, created_at, user_id").in("topic_id", part).order("id").range(from, to)),
      ]);
      const withMaps = blocks.map((b) => {
        const m = b.mindmap_data as { ebook_path?: string | null; title?: string } | null;
        return { ...b, mindmap: m?.ebook_path ? { path: m.ebook_path, title: m.title ?? b.title } : null };
      });
      return { ...identity, name: subj.name, topics: topics ?? [], blocks: withMaps, cards };
    },
  });
  const [book, setBook] = useState<Ebook | null>(null);
  const [editing, setEditing] = useState<EbookEditTarget | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!book) return;
    const paths = [...new Set(book.chapters.flatMap((c) => [
      ...c.sections.flatMap((s) => [s.html, ...s.exercises.flatMap((e) => [textToXhtml(e.question), textToXhtml(e.answer)])]),
      ...c.exercises.flatMap((e) => [textToXhtml(e.question), textToXhtml(e.answer)]),
    ]).flatMap(imagePaths))].filter((p) => !urls[p]);
    if (!paths.length) return;
    supabase.storage.from("ebook-images").createSignedUrls(paths, 3600).then(({ data: signed }) => {
      const next: Record<string, string> = {};
      for (const x of signed ?? []) if (x.path && x.signedUrl) next[x.path] = x.signedUrl;
      setUrls((u) => ({ ...u, ...next }));
    });
  }, [book]); // eslint-disable-line react-hooks/exhaustive-deps
  const withUrls = (html: string) => html.replace(/src="ebook-img:([^"]+)"/g, (_m, p: string) => `src="${urls[p] ?? ""}"`);
  const insertImage = async (file: File) => {
    setUploading(true);
    try {
      const { prepareEbookImage } = await import("@/lib/ebook-image");
      const blob = await prepareEbookImage(file);
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user?.id}/${subjectId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("ebook-images").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setDraft((d) => `${d.trimEnd()}\n\n${imageToken(path, caption.trim())}\n\n`);
      setCaption("");
    } catch { toast.error("Não foi possível enviar a imagem."); } finally { setUploading(false); }
  };
  const [drag, setDrag] = useState<{ ch: string; i: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // ch "" = chapter list; otherwise sections can be dropped into any chapter.
  const dnd = (ch: string, i: number) => ({
    draggable: ownBook && !editing,
    onDragStart: (e: DragEvent) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDrag({ ch, i }); },
    onDragEnd: () => { setDrag(null); setOver(null); },
    onDragOver: (e: DragEvent) => {
      if (!drag || (drag.ch === "") !== (ch === "")) return;
      e.preventDefault(); e.stopPropagation(); setOver(`${ch}:${i}`);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      const d = drag; setDrag(null); setOver(null);
      if (!book || !d || (d.ch === "") !== (ch === "") || (d.ch === ch && d.i === i)) return;
      persist(ch === "" ? moveChapter(book, d.i, i) : moveSectionTo(book, d.ch, d.i, ch, i));
    },
  });
  // Dropping a section on a chapter title appends it to the end of that chapter.
  const chapterDrop = (chId: string, count: number) => ({
    onDragOver: (e: DragEvent) => { if (drag && drag.ch !== "") { e.preventDefault(); e.stopPropagation(); setOver(`${chId}:end`); } },
    onDrop: (e: DragEvent) => {
      if (!drag || drag.ch === "") return;
      e.preventDefault(); e.stopPropagation();
      const d = drag; setDrag(null); setOver(null);
      if (book) persist(moveSectionTo(book, d.ch, d.i, chId, d.ch === chId ? count - 1 : count));
    },
  });
  useEffect(() => {
    if (data) setBook(buildEbook(data.name, document.documentElement.lang || "pt-BR", data.topics,
      data.blocks.flatMap((b) => b.topic_id ? [{ ...b, topic_id: b.topic_id }] : []), data.cards));
  }, [data]);

  const blockIds = new Set((data?.blocks ?? []).map((b: { id: string }) => b.id));
  const editable = (target: EbookEditTarget) => {
    const owner = target.table === "subjects" ? data?.owner
      : target.table === "topics" ? data?.topics.find((row) => row.id === target.id)?.user_id
      : target.table === "microcontexts" ? data?.blocks.find((row) => row.id === target.id)?.user_id
      : data?.cards.find((row) => row.id === target.id)?.user_id;
    return canEditEbook(data?.userId, data?.owner, owner);
  };
  const ownBook = canEditEbook(data?.userId, data?.owner, data?.owner);
  const persist = async (next: Ebook) => {
    if (!ownBook || editing) return;
    setBook(next);
    const ups: PromiseLike<{ error: unknown }>[] = [];
    next.chapters.forEach((c, i) => {
      ups.push(supabase.from("topics").update({ order_index: i }).eq("id", c.id));
      c.sections.forEach((s, j) => {
        if (blockIds.has(s.id)) {
          ups.push(supabase.from("microcontexts").update({ order_index: j, topic_id: c.id }).eq("id", s.id));
          ups.push(supabase.from("flashcards").update({ topic_id: c.id }).eq("microcontext_id", s.id));
        } else ups.push(supabase.from("topics").update({ order_index: j, parent_id: c.id }).eq("id", s.id));
      });
    });
    const results = await Promise.all(ups);
    if (results.some((r) => r.error)) toast.error("Parte da nova ordem não foi salva. Recarregue e tente de novo.");
    await qc.invalidateQueries({ queryKey: ["ebook", subjectId] });
  };
  const remove = async (kind: "topics" | "microcontexts" | "flashcards", id: string, what: string) => {
    if (!book || !data?.userId || editing) return;
    if (!window.confirm(`Apagar ${what}? Isso também remove o conteúdo original no app e não pode ser desfeito.`)) return;
    if (kind === "microcontexts") {
      const { error } = await supabase.from("flashcards").delete().eq("microcontext_id", id).eq("user_id", data.userId);
      if (error) return void toast.error("Não foi possível apagar.");
    }
    const { error, data: gone } = await supabase.from(kind).delete().eq("id", id).eq("user_id", data.userId).select("id");
    if (error || gone?.length !== 1) return void toast.error("Não foi possível apagar.");
    setBook(removeFromEbook(book, id));
    await Promise.all(["ebook", "flashcards", "topics", "microcontexts"].map((k) => qc.invalidateQueries({ queryKey: k === "ebook" ? ["ebook", subjectId] : [k] })));
  };
  const trash = (kind: "topics" | "microcontexts" | "flashcards", id: string, what: string) =>
    canEditEbook(data?.userId, data?.owner, (kind === "topics" ? data?.topics : kind === "microcontexts" ? data?.blocks : data?.cards)?.find((r) => r.id === id)?.user_id)
      ? <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive print:hidden" aria-label={`Apagar ${what}`} title={`Apagar ${what}`} disabled={Boolean(editing)} onClick={() => remove(kind, id, what)}><Trash2 className="h-4 w-4" /></Button>
      : null;
  const saveText = async () => {
    if (!editing || !editable(editing) || !data?.userId || saving) return;
    if (!draft.trim() && editing.field !== "content") return toast.error("O texto não pode ficar vazio.");
    setSaving(true);
    try {
      const query = editing.table === "subjects" ? supabase.from("subjects").update({ name: draft })
        : editing.table === "topics" ? supabase.from("topics").update({ name: draft })
        : editing.table === "microcontexts" ? supabase.from("microcontexts").update(editing.field === "title" ? { title: draft } : { content: draft })
        : supabase.from("flashcards").update(editing.field === "question" ? { question: draft } : { answer: draft });
      const { error, data: changed } = await query.eq("id", editing.id).eq("user_id", data.userId).select("id");
      if (error || changed?.length !== 1) throw error ?? new Error("Write refused");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["ebook", subjectId] }),
        qc.invalidateQueries({ queryKey: ["flashcards"] }),
        qc.invalidateQueries({ queryKey: ["subjects"] }),
        qc.invalidateQueries({ queryKey: ["topics"] }),
        qc.invalidateQueries({ queryKey: ["microcontexts"] }),
      ]);
      setEditing(null);
    } catch { toast.error("Não foi possível salvar. Seu texto continua aberto para tentar novamente."); }
    finally { setSaving(false); }
  };
  const editText = (target: EbookEditTarget, value: string, children: ReactNode) => {
    const active = editing && ebookEditKey(editing) === ebookEditKey(target);
    const label = target.field === "question" ? "pergunta" : target.field === "answer" ? "gabarito" : target.field === "content" ? "texto" : "título";
    const multiline = target.field === "content" || target.field === "question" || target.field === "answer";
    if (active) return <div className="not-prose my-2 w-full min-w-0 space-y-2 print:hidden">
      {multiline ? <Textarea aria-label={`Editar ${label}`} rows={target.field === "content" ? 10 : 5} className="font-mono" value={draft} disabled={saving} onChange={(e) => setDraft(e.target.value)} />
        : <Input aria-label="Editar título" value={draft} disabled={saving} onChange={(e) => setDraft(e.target.value)} />}
      {multiline && <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" aria-label="Legenda da imagem" placeholder="Legenda da imagem" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-sm">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Inserir imagem
          <input type="file" accept="image/*" className="hidden" disabled={uploading || saving} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) insertImage(f); }} />
        </label>
      </div>}
      <div className="flex gap-2"><Button size="sm" disabled={saving || uploading} onClick={saveText}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar</Button><Button size="sm" variant="outline" disabled={saving || uploading} onClick={() => setEditing(null)}>Cancelar</Button></div>
    </div>;
    return <div className="group flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {editable(target) && <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 print:hidden" aria-label={`Editar ${label}`} title={`Editar ${label}`} disabled={Boolean(editing)} onClick={() => { setDraft(value); setCaption(""); setEditing(target); }}><Pencil className="h-4 w-4" /></Button>}
    </div>;
  };
  const exercises = (items: EbookExercise[], answer = false) => <ol>{items.map((e) => <li key={e.id}>
    <div className="flex items-center gap-2"><strong>{e.number}</strong>{!answer && trash("flashcards", e.id, `o exercício ${e.number}`)}</div>
    {editText({ table: "flashcards", field: answer ? "answer" : "question", id: e.id }, answer ? e.answer : e.question,
      <div dangerouslySetInnerHTML={{ __html: withUrls(textToXhtml(answer ? e.answer : e.question)) }} />)}
  </li>)}</ol>;
  const blockText = (id: string) => {
    const block = data?.blocks.find((row) => row.id === id);
    if (!block) return null;
    const reviewed = !!(block as { reviewed_at?: string | null }).reviewed_at;
    const canReview = canEditEbook(data?.userId, data?.owner, block.user_id);
    const toggleReview = async () => {
      const { error } = await supabase.from("microcontexts").update({ reviewed_at: reviewed ? null : new Date().toISOString() }).eq("id", id);
      if (error) return toast.error("Não foi possível atualizar a revisão.");
      await qc.invalidateQueries({ queryKey: ["ebook", subjectId] });
    };
    return (<>
      <div className="not-prose mb-1 print:hidden">
        <button type="button" disabled={!canReview} onClick={toggleReview} title={reviewed ? "Clique para voltar a rascunho" : "Clique depois de conferir o texto"}
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${reviewed ? "border-primary bg-primary/10 text-primary" : "border-destructive/50 bg-destructive/10 text-destructive"}`}>
          {reviewed ? "✓ Revisado" : "Rascunho do PilotAI — conferir"}
        </button>
      </div>
      {editText({ table: "microcontexts", field: "content", id }, block.content,
        <div dangerouslySetInnerHTML={{ __html: withUrls(textToXhtml(block.content)) }} />)}
    </>);
  };
  const exportEpub = async () => {
    if (!book) return;
    setBusy(true);
    try {
      const { buildEpubBlob } = await import("@/lib/ebook-epub");
      const url = URL.createObjectURL(await buildEpubBlob(book, async (p) => (await supabase.storage.from("ebook-images").download(p)).data));
      const a = document.createElement("a");
      a.href = url; a.download = `${book.title}.epub`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally { setBusy(false); }
  };

  if (isLoading || !book) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
  const allEx = book.chapters.flatMap((c) => [...c.sections.flatMap((s) => s.exercises), ...c.exercises]);

  return (
    <div className="w-full p-4 pr-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4 print:hidden">
        <h1 className="text-2xl font-bold text-foreground">Editor do PilotE-book</h1>
        <SpeakButton text={ebookNarration(book, htmlToPlainText)} lang={book.language} ariaLabel="Ouvir ou parar a leitura do PilotE-book" />
      </header>
    <div className="grid gap-6 md:grid-cols-[18rem_1fr] print:block">
      <aside className="space-y-3 print:hidden md:sticky md:top-4 md:self-start">
        <Link to="/subjects/$subjectId" params={{ subjectId }} className="text-sm text-muted-foreground">← Voltar à matéria</Link>
        <div className="flex gap-2">
          <Button size="sm" onClick={exportEpub} disabled={busy || Boolean(editing)}><Download className="mr-1 h-4 w-4" />EPUB / Kindle</Button>
          <Button size="sm" variant="outline" disabled={Boolean(editing)} onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />PDF</Button>
        </div>
        <h2 className="font-semibold">Sumário</h2>
        <ol className="space-y-2 text-sm">
          {book.chapters.map((ch, i) => (
            <li key={ch.id} {...dnd("", i)} className={`cursor-grab rounded ${over === `:${i}` ? "ring-2 ring-primary" : ""}`}>
              <div {...chapterDrop(ch.id, ch.sections.length)} className={`flex items-center gap-1 rounded ${over === `${ch.id}:end` ? "bg-primary/10" : ""}`}>
                <a href={`#${ch.id}`} className="flex-1 font-medium hover:underline">{ch.number} - {ch.title}</a>
                <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Subir capítulo" disabled={!ownBook || Boolean(editing) || i === 0} onClick={() => persist(moveChapter(book, i, i - 1))}><ArrowUp className="h-3 w-3" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Descer capítulo" disabled={!ownBook || Boolean(editing) || i === book.chapters.length - 1} onClick={() => persist(moveChapter(book, i, i + 1))}><ArrowDown className="h-3 w-3" /></Button>
              </div>
              <ol className="ml-4 mt-1 space-y-1">
                {ch.sections.map((s, j) => (
                  <li key={s.id} {...dnd(ch.id, j)} className={`flex cursor-grab items-center gap-1 rounded ${over === `${ch.id}:${j}` ? "border-t-2 border-primary" : ""}`}>
                    <a href={`#${s.id}`} className="flex-1 hover:underline">{s.number} - {s.title}</a>
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Subir seção" disabled={!ownBook || Boolean(editing) || j === 0} onClick={() => persist(moveSection(book, ch.id, j, j - 1))}><ArrowUp className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Descer seção" disabled={!ownBook || Boolean(editing) || j === ch.sections.length - 1} onClick={() => persist(moveSection(book, ch.id, j, j + 1))}><ArrowDown className="h-3 w-3" /></Button>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </aside>
      <article className="prose max-w-none dark:prose-invert">
        {editText({ table: "subjects", field: "name", id: subjectId }, book.title, <h2 className="flex items-center gap-2 break-words"><BookOpen className="shrink-0" />{book.title}</h2>)}
        {!book.chapters.length && <p>Seu e-book começa quando você cria assuntos e cards nesta matéria.</p>}
        {book.chapters.map((ch) => (
          <section key={ch.id} id={ch.id} className="scroll-mt-4">
            {editText({ table: "topics", field: "name", id: ch.id }, ch.title, <h2>{chapterHeading(ch)}</h2>)}
            <div className="not-prose -mt-2 mb-2 flex justify-end">{trash("topics", ch.id, `o capítulo ${ch.number} inteiro`)}</div>
            {ch.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-4">
                {editText(s.kind === "block" ? { table: "microcontexts", field: "title", id: s.id } : { table: "topics", field: "name", id: s.id }, s.title, <h3>{s.number} - {s.title}</h3>)}
                <div className="not-prose -mt-2 flex justify-end">{trash(s.kind === "block" ? "microcontexts" : "topics", s.id, `a seção ${s.number} e seus exercícios`)}</div>
                {s.kind === "block" ? blockText(s.id) : data?.blocks.filter((b) => b.topic_id === s.id).sort((a, b) => (a.order_index ?? 1e9) - (b.order_index ?? 1e9) || a.created_at.localeCompare(b.created_at)).map((b) => <div key={b.id}>
                  {editText({ table: "microcontexts", field: "title", id: b.id }, b.title, <h4>{b.title}</h4>)}
                  {blockText(b.id)}
                </div>)}
                {s.exercises.length > 0 && <><h4>Exercícios</h4>{exercises(s.exercises)}</>}
              </section>
            ))}
            {ch.exercises.length > 0 && <><h4>Exercícios do capítulo</h4>{exercises(ch.exercises)}</>}
          </section>
        ))}
        {allEx.length > 0 && <section className="break-before-page"><h2>Gabarito comentado</h2>{exercises(allEx, true)}</section>}
      </article>
    </div>
    </div>
  );
}
