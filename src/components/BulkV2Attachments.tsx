import { useState } from "react";
import { useRef } from "react";
import { T, getUiLang } from "@/lib/i18n-ui";
import { readDocumentText } from "@/lib/document-import";
import { uploadMindMapImage, getMindMapSignedUrl } from "@/lib/mindmap-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AiFormatNoteDialog } from "@/components/AiFormatNoteDialog";
import { GenerateMindMapDialog } from "@/components/GenerateMindMapDialog";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateStudyNote } from "@/lib/card-note.functions";
import { toastAiError } from "@/lib/ai-error-toast";
import { useAiBillingInfo } from "@/hooks/useAiBillingInfo";
import { FileText, Network, Video, Loader2, Sparkles, Upload, X, Image as ImageIcon } from "lucide-react";

export type BulkAttachments = {
  noteId: string | null;
  imagePath: string | null;
  imageCategoryId: string | null;
  video1: string | null;
  video2: string | null;
};

export const EMPTY_ATTACHMENTS: BulkAttachments = {
  noteId: null, imagePath: null, imageCategoryId: null, video1: null, video2: null,
};

/** Categoria espelho do tópico/assunto escolhido (anotações = matérias/assuntos). */
async function mirrorCategoryFor(topicId: string | null): Promise<string | null> {
  if (!topicId) return null;
  const { data } = await supabase.from("note_categories").select("id").eq("topic_id", topicId).limit(1).maybeSingle();
  return data?.id ?? null;
}

function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
}

const cardCls = "space-y-4 rounded-2xl border border-border bg-card p-4";
const innerCls = "space-y-2 rounded-xl border border-border bg-muted/30 p-3";
const NONE = "__none__";

export function BulkV2Attachments(props: {
  value: BulkAttachments;
  onChange: (v: BulkAttachments) => void;
  targetTopicId: string | null;
  /** Perguntas e respostas da sessão, usadas no mapa quando não há anotação. */
  sessionCards?: Array<{ question: string; answer: string }>;
  sourceText?: string;
  hideVideos?: boolean;
}) {
  const { value, onChange, targetTopicId, sessionCards = [], sourceText = "", hideVideos = false } = props;
  const generateNote = useServerFn(generateStudyNote);
  const billing = useAiBillingInfo();
  const [drafting, setDrafting] = useState(false);
  const noteFileRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [readingNote, setReadingNote] = useState(false);
  const notesQ = useQuery({
    queryKey: ["notes-picker", "bulk-v2-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("id, title").order("title").limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const mapsQ = useQuery({
    queryKey: ["note_media", "bulk-v2-maps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("note_media")
        .select("id, title, storage_path, category_id")
        .in("kind", ["mindmap", "image"]).not("storage_path", "is", null)
        .order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const [uploadingImg, setUploadingImg] = useState(false);
  const cardsText = sourceText.trim() || sessionCards
    .filter((c) => c.question.trim() || c.answer.trim())
    .map((c) => `- ${c.question.trim()}\n  ${c.answer.trim()}`)
    .join("\n");

  async function draftNote() {
    if (cardsText.trim().length < 40 || cardsText.length > 20_000) return;
    setDrafting(true);
    try {
      const result = await generateNote({ data: { actionId: crypto.randomUUID(), text: cardsText, lang: getUiLang() } });
      setTitle(result.title);
      setBody(result.text);
      qc.invalidateQueries({ queryKey: ["ai-billing"] });
    } catch (error) {
      toastAiError(error);
    } finally {
      setDrafting(false);
    }
  }

  async function onNoteFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setReadingNote(true);
    try {
      const text = await readDocumentText(file, 100_000);
      setTitle(file.name.replace(/\.[^.]+$/, "").slice(0, 200));
      setBody(text);
      setNoteOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : T("Não foi possível ler o arquivo."));
    } finally {
      setReadingNote(false);
    }
  }

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error(T("Envie um arquivo de imagem"));
    if (file.size > 8 * 1024 * 1024) return void toast.error(T("Imagem muito grande (máx 8MB)"));
    setUploadingImg(true);
    try {
      const cat = await mirrorCategoryFor(targetTopicId);
      const path = await uploadMindMapImage(file, cat);
      onChange({ ...value, imagePath: path, imageCategoryId: cat });
      toast.success(T("Imagem anexada"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : T("Falha ao enviar imagem"));
    } finally {
      setUploadingImg(false);
    }
  }

  const [mapCategoryId, setMapCategoryId] = useState<string | null>(null);
  async function openMap() {
    if (!value.noteId && cardsText.replace(/\s/g, "").length < 40) {
      return void toast.error(T("Crie ou escreva alguns flashcards antes de gerar o mapa mental."));
    }
    setMapCategoryId(await mirrorCategoryFor(targetTopicId));
    setMapOpen(true);
  }
  const qc = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [format, setFormat] = useState<{ id: string; title: string; html: string } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [createdNote, setCreatedNote] = useState<{ id: string; title: string } | null>(null);
  const noteTitle = notesQ.data?.find((n) => n.id === value.noteId)?.title
    || (createdNote?.id === value.noteId ? createdNote.title : "")
    || T("Título da anotação");
  const imageTitle = mapsQ.data?.find((m) => m.storage_path === value.imagePath)?.title || T("Imagem anexada");
  const imagePreview = useQuery({
    queryKey: ["bulk-v2-attachment-preview", value.imagePath],
    queryFn: () => value.imagePath ? getMindMapSignedUrl(value.imagePath) : Promise.resolve(null),
    enabled: !!value.imagePath,
    staleTime: 50 * 60 * 1000,
    retry: 1,
  });

  async function saveNote(andFormat: boolean) {
    if (!title.trim() || !body.trim()) return toast.error(T("Preencha o título e o texto da anotação."));
    setSavingNote(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(T("Sessão expirada. Entre novamente."));
      const html = textToHtml(body);
      const category_id = await mirrorCategoryFor(targetTopicId);
      const { data, error } = await supabase.from("notes")
        .insert({ user_id: u.user.id, title: title.trim().slice(0, 200), content_html: html, category_id })
        .select("id").single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["notes-picker"] });
      onChange({ ...value, noteId: data.id });
      setCreatedNote({ id: data.id, title: title.trim() });
      setNoteOpen(false);
      toast.success(T("Anotação salva e vinculada aos flashcards."));
      if (andFormat) setFormat({ id: data.id, title: title.trim(), html });
      setTitle(""); setBody("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha ao salvar"));
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{hideVideos ? T("Criar anotação") + " / " + T("Gerar mapa mental") : T("Anexar anotações, imagens e vídeos aos flashcards")}</h2>
        {!hideVideos && <p className="text-xs text-muted-foreground">{T("Opcional. O que você escolher aqui vai para todos os flashcards da lista.")}</p>}
      </div>
      <div className={hideVideos ? "grid gap-3 md:grid-cols-2" : "grid gap-3 md:grid-cols-3"}>
        <div className={cardCls}>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><FileText className="h-4 w-4 text-primary" />{T("Resumo / anotação")}</p>
          <div className={innerCls}>
            <Select value={value.noteId ?? NONE} onValueChange={(v) => onChange({ ...value, noteId: v === NONE ? null : v })}>
              <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder={T("Carregar do FlashPilot")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{T("Carregar do FlashPilot")}</SelectItem>
                {value.noteId && !(notesQ.data ?? []).some((n) => n.id === value.noteId) && (
                  <SelectItem value={value.noteId}>{noteTitle}</SelectItem>
                )}
                {(notesQ.data ?? []).map((n) => <SelectItem key={n.id} value={n.id}>{n.title || "—"}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="h-10 w-full rounded-lg" onClick={() => { setTitle(""); setBody(""); setNoteOpen(true); }}>
              <Sparkles className="mr-1 h-4 w-4" />{T("Criar anotação")}
            </Button>
          </div>
          {value.noteId && (
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background p-2" role="status">
              <FileText className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 break-words text-sm text-foreground">{noteTitle}</span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                title={T("Desvincular (mantém o conteúdo)")} aria-label={T("Desvincular (mantém o conteúdo)")}
                onClick={() => onChange({ ...value, noteId: null })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <input ref={noteFileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={onNoteFile} />
          <div className="flex justify-center">
            <Button type="button" variant="secondary" className="rounded-lg" disabled={readingNote} onClick={() => noteFileRef.current?.click()}>
              {readingNote ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />} {T("Enviar anotação")}
            </Button>
          </div>
        </div>
        <div className={cardCls}>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Network className="h-4 w-4 text-primary" />{T("Mapa mental / imagem")}</p>
          <div className={innerCls}>
            <Select value={value.imagePath ?? NONE} onValueChange={(v) => {
              if (v === NONE) return onChange({ ...value, imagePath: null, imageCategoryId: null });
              const m = (mapsQ.data ?? []).find((x) => x.storage_path === v);
              onChange({ ...value, imagePath: v, imageCategoryId: m?.category_id ?? null });
            }}>
              <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder={T("Carregar do FlashPilot")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{T("Carregar do FlashPilot")}</SelectItem>
                {value.imagePath && !(mapsQ.data ?? []).some((m) => m.storage_path === value.imagePath) && (
                  <SelectItem value={value.imagePath}>{T("Imagem anexada")}</SelectItem>
                )}
                {(mapsQ.data ?? []).map((m) => m.storage_path ? <SelectItem key={m.id} value={m.storage_path}>{m.title || T("Mapa mental")}</SelectItem> : null)}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" className="h-10 w-full rounded-lg" onClick={openMap}>
              <Sparkles className="mr-1 h-4 w-4" />{T("Gerar mapa mental")}
            </Button>
          </div>
          {value.imagePath && (
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-background p-2" role="status">
              <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {imagePreview.data ? (
                  <img src={imagePreview.data} alt={imageTitle} className="h-full w-full object-contain select-none pointer-events-none" />
                ) : imagePreview.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
              </div>
              <span className="min-w-0 flex-1 break-words text-sm text-foreground">{imageTitle}</span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                title={T("Desvincular (mantém o conteúdo)")} aria-label={T("Desvincular (mantém o conteúdo)")}
                onClick={() => onChange({ ...value, imagePath: null, imageCategoryId: null })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={onImageFile} />
          <div className="flex justify-center">
            <Button type="button" variant="secondary" className="rounded-lg" disabled={uploadingImg} onClick={() => imageFileRef.current?.click()}>
              {uploadingImg ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />} {T("Enviar imagem")}
            </Button>
          </div>
        </div>
        {!hideVideos && <div className={cardCls}>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Video className="h-4 w-4 text-primary" />{T("Colar links de vídeo")}</p>
          {[1, 2].map((n) => (
            <Input key={n} type="url" inputMode="url" className="h-10 rounded-lg"
              placeholder={T("Link do vídeo {n} (YouTube, Vimeo etc.)", { n })}
              value={(n === 1 ? value.video1 : value.video2) ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : e.target.value;
                onChange({ ...value, ...(n === 1 ? { video1: v } : { video2: v }) });
              }} />
          ))}
        </div>}
      </div>
      {!hideVideos && <p className="text-center text-xs text-muted-foreground">{T("Os links aparecem no verso do card e podem ser editados a qualquer momento.")}</p>}

      <Dialog open={noteOpen} onOpenChange={(o) => !savingNote && !drafting && setNoteOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{T("Resumo / anotação")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Button variant="secondary" disabled={drafting || savingNote || cardsText.trim().length < 40 || cardsText.length > 20_000} onClick={draftNote}>
              {drafting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}{body ? T("Gerar novamente") : T("Gerar")}
            </Button>
            <p className="text-xs text-muted-foreground">{T("A geração usa seus créditos do PilotAI.")}{billing.data?.prices.note_format ? ` ${T("Depois da cota incluída: {coins} FlashCoins por ação.", { coins: billing.data.prices.note_format })}` : ""}</p>
            <Input disabled={drafting} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={T("Título da anotação")} />
            <textarea disabled={drafting} value={body} onChange={(e) => setBody(e.target.value)} rows={12}
              placeholder={T("Escreva ou cole o texto da anotação…")}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            <p className="text-[11px] text-muted-foreground">{T("A anotação fica guardada na mesma matéria e assunto escolhidos para os flashcards.")}</p>
          </div>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setNoteOpen(false)} disabled={savingNote || drafting}>{T("Cancelar")}</Button>
            <Button variant="outline" onClick={() => saveNote(true)} disabled={savingNote || drafting}>
              <Sparkles className="h-4 w-4 mr-1" /> {T("Salvar e formatar com o PilotAI")}
            </Button>
            <Button onClick={() => saveNote(false)} disabled={savingNote || drafting || !title.trim() || !body.trim()}>
              {savingNote && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} {T("Salvar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AiFormatNoteDialog
        open={!!format}
        onOpenChange={(o) => { if (!o) setFormat(null); }}
        noteId={format?.id ?? null}
        title={format?.title ?? ""}
        html={format?.html ?? ""}
        onApplied={() => qc.invalidateQueries({ queryKey: ["notes-picker"] })}
      />

      <GenerateMindMapDialog
        open={mapOpen}
        onOpenChange={setMapOpen}
        source={value.noteId
          ? { kind: "note", noteId: value.noteId, title: noteTitle, categoryId: null }
          : cardsText ? { kind: "text", text: cardsText, lang: getUiLang() } : null}
        fixedCategoryId={mapCategoryId}
        onSaved={(s) => onChange({ ...value, imagePath: s.path, imageCategoryId: s.categoryId })}
      />
    </section>
  );
}
