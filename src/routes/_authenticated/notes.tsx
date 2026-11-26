import { createFileRoute } from "@tanstack/react-router";
import { T } from "@/lib/i18n-ui";
import { pageHead } from "@/lib/page-head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  FileText,
  Save,
  FolderPlus,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Folder,
  Pencil,
  Sparkles,
  Undo2,
  Printer,
  Image as ImageIcon,
  Video,
  Upload,
  X,
  Link2,
  Unlink,
  Layers,
  RefreshCw,
  Network,
  Lock,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AiFormatNoteDialog } from "@/components/AiFormatNoteDialog";
import { BulkFormatNotesDialog } from "@/components/BulkFormatNotesDialog";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SpeakButton } from "@/components/SpeakButton";
import { NoteExportMenu } from "@/components/NoteExportMenu";
import { FlashPilotTv, type TvSource } from "@/components/FlashPilotTv";
import { normalizeScenes, type TvStyle } from "@/lib/card-video";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";
import { YouTubePlayer, parseYouTubeId } from "@/components/YouTubePlayer";
import { uploadMindMapImage } from "@/lib/mindmap-image";
import { GenerateMindMapDialog } from "@/components/GenerateMindMapDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { htmlToPlainText, ttsSupported } from "@/lib/tts";
import { useT, useLang } from "@/lib/i18n";
import { useScreenT } from "@/lib/i18n-screens";
import { usePurchasedTexts } from "@/lib/i18n-purchased";
import { usePlanLimit } from "@/lib/plan-limit";
import { normalizeNoteHtml } from "@/lib/note-format";
import { format } from "date-fns";
import { z } from "zod";

const searchSchema = z.object({ id: z.string().optional() });

export const Route = createFileRoute("/_authenticated/notes")({
  head: () =>
    pageHead(
      "Minhas anotações — FlashPilot",
      "Organize suas anotações e materiais de estudo no FlashPilot.",
    ),
  validateSearch: (s) => searchSchema.parse(s),
  component: NotesPage,
});

type Note = {
  id: string;
  title: string;
  content_html: string;
  content_html_backup: string | null;
  updated_at: string;
  category_id: string | null;
  source_id?: string | null;
};

type Cat = {
  id: string;
  name: string;
  parent_id: string | null;
  subject_id?: string | null;
  topic_id?: string | null;
  is_mirror?: boolean;
  source_id?: string | null;
};

type Media = {
  id: string;
  kind: "image" | "video" | "mindmap";
  title: string;
  storage_path: string | null;
  url: string | null;
  category_id: string | null;
  note_id: string | null;
  readonly?: boolean;
  source_id?: string | null;
  tv?: TvSource;
};

type NoteCard = {
  id: string;
  question: string;
  answer: string;
  linked_note_id: string | null;
  image_category_id: string | null;
  topic_id: string;
};

type Selection =
  | { kind: "note"; id: string }
  | { kind: "card"; id: string; question: string; answer: string }
  | { kind: "image"; id: string; title: string; path?: string | null; src?: string | null }
  | { kind: "video"; id: string; title: string; url: string }
  | { kind: "tv"; id: string; title: string; tv: TvSource };

const FILTER_ALL = "__all__";
const FILTER_UNCAT = "__uncat__";

function NotesPage() {
  const t = useT();
  const s = useScreenT();
  const { locale, lang } = useLang();
  const purchasedTexts = usePurchasedTexts(lang);
  const { isAppManager } = usePlanLimit();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { id: searchId } = Route.useSearch();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState<string>(FILTER_ALL);
  const [listFilter, setListFilter] = useState<string>(FILTER_ALL);
  const [manageOpen, setManageOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Cat | null>(null);
  const [syncTarget, setSyncTarget] = useState<{ cat: Cat; count: number } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [mindMapOpen, setMindMapOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<{
    categoryId: string | null;
    noteId: string | null;
  } | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notes = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, content_html, content_html_backup, updated_at, category_id, source_id")
        .order("title", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Note[];
    },
  });

  const cats = useQuery({
    queryKey: ["note_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_categories")
        .select("id, name, parent_id, subject_id, topic_id, is_mirror, source_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Cat[];
    },
  });

  const media = useQuery({
    queryKey: ["note_media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_media")
        .select("id, kind, title, storage_path, url, category_id, note_id, source_id")
        .order("order_index")
        .order("title");
      if (error) throw error;
      return (data ?? []) as Media[];
    },
  });

  // Mídias já cadastradas nos flashcards (somente leitura)
  const cardMedia = useQuery({
    queryKey: ["note_card_media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select(
          "id, question, image_url, image_category_id, video_url_1, video_url_2, linked_note_id",
        )
        .or("image_url.not.is.null,video_url_1.not.is.null,video_url_2.not.is.null")
        .limit(2000);
      if (error) throw error;
      const out: Media[] = [];
      for (const f of data ?? []) {
        const label = (f.question ?? "").slice(0, 60) || "Flashcard";
        if (f.image_url) {
          out.push({
            id: `fc-img-${f.id}`,
            kind: "image",
            title: label,
            storage_path: f.image_url,
            url: null,
            category_id: f.image_category_id,
            note_id: f.linked_note_id,
            readonly: true,
          });
        }
        [f.video_url_1, f.video_url_2].forEach((v, i) => {
          if (v) {
            out.push({
              id: `fc-vid-${f.id}-${i}`,
              kind: "video",
              title: label,
              storage_path: null,
              url: v,
              category_id: f.image_category_id,
              note_id: f.linked_note_id,
              readonly: true,
            });
          }
        });
      }
      return out;
    },
  });

  // Microvídeos FlashPilot-TV dos cards: entram no acervo na categoria-espelho do tópico do card.
  const tvMedia = useQuery({
    queryKey: ["note_card_tv"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_videos")
        .select(
          "id, scenes, lang, style, transcript, transcript_note, flashcards(question, topic_id, image_category_id)",
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allMedia = useMemo(() => {
    const topicCat = new Map<string, string>();
    for (const c of cats.data ?? []) if (c.topic_id && c.is_mirror) topicCat.set(c.topic_id, c.id);
    const tv: Media[] = (tvMedia.data ?? []).map((r: any) => {
      const fc = Array.isArray(r.flashcards) ? r.flashcards[0] : r.flashcards;
      const label =
        String(fc?.question ?? "")
          .replace(/<[^>]+>/g, "")
          .slice(0, 60) || "FlashPilot-TV";
      return {
        id: `tv-${r.id}`,
        kind: "video",
        title: `TV · ${label}`,
        storage_path: null,
        url: null,
        category_id: (fc?.topic_id && topicCat.get(fc.topic_id)) || fc?.image_category_id || null,
        note_id: null,
        readonly: true,
        tv: {
          kind: "generated",
          id: r.id,
          scenes: normalizeScenes({ scenes: r.scenes }),
          lang: r.lang,
          style: r.style as TvStyle,
          transcript: r.transcript,
          transcriptNote: r.transcript_note,
        },
      };
    });
    return [...(media.data ?? []), ...(cardMedia.data ?? []), ...tv];
  }, [media.data, cardMedia.data, tvMedia.data, cats.data]);

  // Mapa tópico → matéria, usado para detectar divergência em categorias-espelho de matéria
  const topicsMap = useQuery({
    queryKey: ["note_topics_map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("topics").select("id, subject_id");
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((t) => m.set(t.id, t.subject_id));
      return m;
    },
  });

  // Flashcards vinculados a anotações ou categorias (somente leitura)
  const noteCards = useQuery({
    queryKey: ["note_linked_cards"],
    queryFn: async () => {
      const out: NoteCard[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("flashcards")
          .select("id, question, answer, linked_note_id, image_category_id, topic_id")
          .order("question")
          .range(from, from + page - 1);
        if (error) throw error;
        out.push(...((data ?? []) as NoteCard[]));
        if (!data || data.length < page) break;
      }
      return out;
    },
  });

  const cardsOfNote = (noteId: string) =>
    (noteCards.data ?? []).filter((c) => c.linked_note_id === noteId);

  const cardsOfCategory = (catId: string, categoryNotes: Note[]) => {
    const noteIds = new Set(categoryNotes.map((n) => n.id));
    return (noteCards.data ?? []).filter(
      (c) =>
        c.image_category_id === catId || (c.linked_note_id ? noteIds.has(c.linked_note_id) : false),
    );
  };

  const mediaOfCategory = (catId: string | null) =>
    allMedia.filter((m) => !m.note_id && (m.category_id ?? null) === catId);
  const mediaOfNote = (noteId: string) => allMedia.filter((m) => m.note_id === noteId);

  const addMedia = useMutation({
    mutationFn: async (payload: {
      kind: "image" | "video";
      title: string;
      file?: File | null;
      url?: string | null;
      categoryId: string | null;
      noteId: string | null;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      let storagePath: string | null = null;
      if (payload.kind === "image") {
        if (!payload.file) throw new Error(T("Selecione uma imagem."));
        storagePath = await uploadMindMapImage(payload.file, payload.categoryId);
      }
      const { error } = await supabase.from("note_media").insert({
        user_id: u.user.id,
        kind: payload.kind,
        title: payload.title.trim() || (payload.kind === "image" ? s.notes.image : s.notes.video),
        storage_path: storagePath,
        url: payload.kind === "video" ? (payload.url ?? "") : null,
        category_id: payload.categoryId,
        note_id: payload.noteId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(s.notes.contentAdded);
      setAddTarget(null);
      qc.invalidateQueries({ queryKey: ["note_media"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const removeMedia = useMutation({
    mutationFn: async (id: string) => {
      const m = (media.data ?? []).find((x) => x.id === id);
      if (m?.source_id && !isAppManager) throw new Error(purchasedTexts.cannotDeleteItem);
      const { error } = await supabase.from("note_media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["note_media"] });
      setSelection((s) => (s && s.kind !== "note" ? null : s));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const syncCategoryCards = useMutation({
    mutationFn: async (catId: string) => {
      const { data, error } = await supabase.rpc("sync_note_category_flashcards", {
        p_category_id: catId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      toast.success(T("{count} flashcard(s) sincronizado(s) com o assunto", { count }));
      setSyncTarget(null);
      qc.invalidateQueries({ queryKey: ["note_linked_cards"] });
      qc.invalidateQueries({ queryKey: ["note_card_media"] });
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : T("Falha ao sincronizar flashcards")),
  });

  const catById = useMemo(() => {
    const m = new Map<string, Cat>();
    (cats.data ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [cats.data]);

  const catLabel = (id: string | null): string => {
    if (!id) return t.notes.uncategorized;
    const parts: string[] = [];
    let cur = catById.get(id);
    let guard = 0;
    while (cur && guard++ < 8) {
      parts.unshift(cur.name);
      cur = cur.parent_id ? catById.get(cur.parent_id) : undefined;
    }
    return parts.length ? parts.join(" › ") : t.notes.uncategorized;
  };

  // Handle ?id= deep-link
  useEffect(() => {
    if (searchId && notes.data?.some((n) => n.id === searchId)) {
      const n = notes.data.find((x) => x.id === searchId)!;
      setSelectedId(n.id);
      setTitle(n.title);
      setContent(n.content_html);
      setCategoryId(n.category_id);
      setDirty(false);
    }
  }, [searchId, notes.data]);

  // Auto-select first note when list loads
  useEffect(() => {
    if (!selectedId && !searchId && notes.data && notes.data.length > 0) {
      const first = notes.data[0];
      setSelectedId(first.id);
      setTitle(first.title);
      setContent(first.content_html);
      setCategoryId(first.category_id);
      setDirty(false);
    }
  }, [notes.data, selectedId, searchId]);

  const selected = useMemo(
    () => notes.data?.find((n) => n.id === selectedId) ?? null,
    [notes.data, selectedId],
  );

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      const initialCat = filter !== FILTER_ALL && filter !== FILTER_UNCAT ? filter : null;
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: u.user.id,
          title: t.notes.untitled,
          content_html: "<p></p>",
          category_id: initialCat,
        })
        .select("id, title, content_html, content_html_backup, updated_at, category_id")
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["notes-picker"] });
      setSelectedId(n.id);
      setTitle(n.title);
      setContent(n.content_html);
      setCategoryId(n.category_id);
      setDirty(false);
      if (isMobile) setMobileOpen(true);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const { error } = await supabase
        .from("notes")
        .update({
          title: title.trim() || t.notes.untitled,
          content_html: normalizeNoteHtml(content),
          category_id: categoryId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["notes-picker"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const undoFormat = useMutation({
    mutationFn: async (id: string) => {
      const n = (notes.data ?? []).find((x) => x.id === id);
      if (!n?.content_html_backup) throw new Error(s.notes.noPrevious);
      const { error } = await supabase
        .from("notes")
        .update({ content_html: n.content_html_backup, content_html_backup: null })
        .eq("id", id);
      if (error) throw error;
      return n.content_html_backup;
    },
    onSuccess: (html) => {
      setContent(html);
      setDirty(false);
      toast.success(s.notes.formatUndone);
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const n = (notes.data ?? []).find((x) => x.id === id);
      if (n?.source_id && !isAppManager) throw new Error(purchasedTexts.cannotDeleteItem);
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      toast.success(t.notes.removed);
      if (selectedId === id) {
        setSelectedId(null);
        setTitle("");
        setContent("");
        setCategoryId(null);
        setDirty(false);
      }
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["notes-picker"] });
    },
  });

  // Autosave 1.2s debounce
  useEffect(() => {
    if (!dirty || !selectedId) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => save.mutate(), 1200);
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, title, content, categoryId, selectedId]);

  function selectNote(n: Note) {
    if (dirty && selectedId) save.mutate();
    setSelectedId(n.id);
    setTitle(n.title);
    setContent(n.content_html);
    setCategoryId(n.category_id);
    setDirty(false);
    setSelection({ kind: "note", id: n.id });
    if (isMobile) setMobileOpen(true);
  }

  function openMedia(m: Media) {
    if (m.kind === "image" || m.kind === "mindmap") {
      setSelection({
        kind: "image",
        id: m.id,
        title: m.title,
        path: m.storage_path,
        src: m.kind === "mindmap" ? null : m.url,
      });
    } else if (m.tv) {
      setSelection({ kind: "tv", id: m.id, title: m.title, tv: m.tv });
    } else {
      setSelection({ kind: "video", id: m.id, title: m.title, url: m.url ?? "" });
    }
    if (isMobile) setMobileOpen(true);
  }

  function toggleNoteExpand(id: string) {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const listNotes = useMemo(() => {
    const all = notes.data ?? [];
    if (listFilter === FILTER_ALL) return all;
    if (listFilter === FILTER_UNCAT) return all.filter((n) => !n.category_id);
    return all.filter((n) => n.category_id === listFilter);
  }, [notes.data, listFilter]);

  const topCats = (cats.data ?? []).filter((c) => !c.parent_id);
  const mirrorTopCats = topCats.filter((c) => c.is_mirror);
  const ownTopCats = topCats.filter((c) => !c.is_mirror);
  const subsOf = (id: string) => (cats.data ?? []).filter((c) => c.parent_id === id);

  function toggleExpand(id: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function contentBody() {
    if (selection && selection.kind === "image") {
      return (
        <ImageZoomViewer
          key={selection.id}
          path={selection.path}
          src={selection.src}
          title={selection.title}
        />
      );
    }
    if (selection && selection.kind === "tv") {
      return (
        <div
          key={selection.id}
          className="relative mx-auto w-full max-w-md aspect-[9/14] rounded-3xl"
        >
          <FlashPilotTv
            source={selection.tv}
            onClose={() => setSelection(null)}
            onDeleted={() => {
              setSelection(null);
              void tvMedia.refetch();
            }}
          />
        </div>
      );
    }
    if (selection && selection.kind === "video") {
      return <YouTubePlayer key={selection.id} url={selection.url} title={selection.title} />;
    }
    if (selection && selection.kind === "card") {
      return (
        <Card className="p-5 space-y-4 select-none">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {s.notes.linkedFlashcard}
          </p>
          <div className="note-font whitespace-pre-wrap text-base font-medium">
            {selection.question}
          </div>
          <div className="border-t border-border pt-4 note-font whitespace-pre-wrap">
            {selection.answer}
          </div>
        </Card>
      );
    }

    if (!selected) {
      return (
        <Card className="p-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <h2 className="mt-4 font-serif text-xl">{t.notes.selectOrCreate}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t.notes.hint}</p>
          <Button className="mt-4" onClick={() => create.mutate()}>
            <Plus className="h-4 w-4 mr-1" /> {t.notes.new}
          </Button>
        </Card>
      );
    }
    return (
      <>
        <div className="grid min-w-0 grid-cols-1 gap-2 2xl:grid-cols-[minmax(14rem,1fr)_minmax(12rem,14rem)_auto]">
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            placeholder={t.notes.titlePh}
            className="note-font h-12 min-w-0 bg-card"
          />
          <Select
            value={categoryId ?? "__none__"}
            onValueChange={(v) => {
              setCategoryId(v === "__none__" ? null : v);
              setDirty(true);
            }}
          >
            <SelectTrigger className="h-12 w-full min-w-0">
              <SelectValue placeholder={t.notes.moveToCategory} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t.notes.noCategory}</SelectItem>
              {topCats.map((c) => (
                <SelectGroup key={c.id}>
                  <SelectLabel>{c.name}</SelectLabel>
                  <SelectItem value={c.id}>{c.name}</SelectItem>
                  {subsOf(c.id).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      &nbsp;&nbsp;› {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <div className="flex min-w-0 flex-wrap items-center gap-2 2xl:justify-end">
            {ttsSupported() && (
              <SpeakButton
                text={`${title}. ${htmlToPlainText(content)}`}
                ariaLabel={s.notes.narrate}
                className="h-10 w-10 shrink-0"
              />
            )}
            <Button
              variant="outline"
              className="min-w-0 max-w-full whitespace-normal text-left"
              onClick={() => {
                if (dirty) save.mutate();
                setMindMapOpen(true);
              }}
              title={s.notes.genMindMap}
            >
              <Network className="h-4 w-4 shrink-0" /> <span className="min-w-0">{s.notes.genMindMapBtn}</span>
            </Button>
            <Button
              className="min-w-0 max-w-full whitespace-normal text-left"
              variant="outline"
              onClick={() => {
                if (dirty) save.mutate();
                setAiOpen(true);
              }}
              title={s.notes.aiFormat}
            >
              <Sparkles className="h-4 w-4 shrink-0" /> <span className="min-w-0">{s.notes.aiFormatBtn}</span>
            </Button>
            <NoteExportMenu title={title} html={content} className="min-w-0" />
            {selected.content_html_backup && (
              <Button
                variant="ghost"
                onClick={() => undoFormat.mutate(selected.id)}
                disabled={undoFormat.isPending}
                title={s.notes.undoFormat}
              >
                <Undo2 className="h-4 w-4 shrink-0" /> {s.notes.undoBtn}
              </Button>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
              <Save className="h-4 w-4 shrink-0" />
              {save.isPending ? t.common.saving : dirty ? t.common.save : t.notes.saved}
            </Button>
          </div>
        </div>
        <RichTextEditor
          value={content}
          onChange={(html) => {
            setContent(html);
            setDirty(true);
          }}
        />
        <p className="text-xs text-muted-foreground text-right">
          {dirty
            ? t.notes.unsaved
            : `${t.notes.savedAt} ${format(new Date(selected.updated_at), "HH:mm", { locale })}`}
        </p>
      </>
    );
  }

  function mediaRow(m: Media, indent: number) {
    const active = selection && selection.kind !== "note" && selection.id === m.id;
    return (
      <div
        key={m.id}
        className={`group flex items-center rounded ${active ? "bg-secondary" : "hover:bg-secondary/60"}`}
        style={{ paddingLeft: indent }}
      >
        <button
          type="button"
          onClick={() => openMedia(m)}
          title={`${m.kind === "video" ? s.notes.openVideo : m.kind === "mindmap" ? s.notes.openMindMap : s.notes.openImage}: ${m.title}${m.readonly ? ` (${s.notes.fromFlashcard})` : ""}`}
          className="flex-1 min-w-0 text-left py-1.5 pr-1 flex items-center gap-2"
        >
          {m.kind === "video" ? (
            <Video className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : m.kind === "mindmap" ? (
            <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{m.title}</span>
          {m.readonly && (
            <span className="text-[10px] text-muted-foreground shrink-0">{T("(card)")}</span>
          )}
        </button>
        {!m.readonly && (isAppManager || !m.source_id) && (
          <button
            type="button"
            onClick={() => {
              if (confirm(T("Remover este item?"))) removeMedia.mutate(m.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
            aria-label={t.common.remove}
            title={T("Remover este item")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  function cardRow(c: NoteCard, indent: number) {
    const active = selection?.kind === "card" && selection.id === c.id;
    return (
      <div
        key={c.id}
        className={`flex items-center rounded ${active ? "bg-secondary" : "hover:bg-secondary/60"}`}
        style={{ paddingLeft: indent }}
      >
        <button
          type="button"
          onClick={() => {
            setSelection({ kind: "card", id: c.id, question: c.question, answer: c.answer });
            if (isMobile) setMobileOpen(true);
          }}
          title={`Ver flashcard: ${c.question}`}
          className="flex-1 min-w-0 text-left py-1.5 pr-1 flex items-center gap-2"
        >
          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{c.question}</span>
        </button>
      </div>
    );
  }

  function noteRow(n: Note, indent: number) {
    const atts = mediaOfNote(n.id);
    const cards = cardsOfNote(n.id);
    const open = expandedNotes.has(n.id);
    const active = selection?.kind === "note" && selection.id === n.id;
    const hasChildren = atts.length > 0 || cards.length > 0;
    return (
      <div key={n.id}>
        <div
          className={`group flex items-center rounded ${active ? "bg-secondary" : "hover:bg-secondary/60"}`}
          style={{ paddingLeft: indent }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNoteExpand(n.id)}
              className="p-1 text-muted-foreground"
              aria-label={T("Expandir")}
              title={
                open
                  ? T("Recolher anexos e flashcards")
                  : T("Expandir: {cards} flashcard(s) e {attachments} anexo(s)", {
                      cards: cards.length,
                      attachments: atts.length,
                    })
              }
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <button
            type="button"
            onClick={() => selectNote(n)}
            title={T("Abrir anotação: {name}", { name: n.title || t.notes.untitled })}
            className="flex-1 min-w-0 text-left py-1.5 pr-1 flex items-center gap-2"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{n.title || t.notes.untitled}</span>
            {cards.length > 0 && (
              <span className="text-[10px] text-muted-foreground shrink-0">{cards.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setAddTarget({ categoryId: n.category_id, noteId: n.id })}
            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground"
            aria-label={s.notes.addMedia}
            title={s.notes.addMediaTitle}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {open && cards.map((c) => cardRow(c, indent + 22))}
        {open && atts.map((m) => mediaRow(m, indent + 22))}
      </div>
    );
  }

  function renderCat(c: Cat, depth: number) {
    const subs = subsOf(c.id);
    const expanded = expandedCats.has(c.id);
    const catNotes = (notes.data ?? []).filter((n) => n.category_id === c.id);
    const catMedia = mediaOfCategory(c.id);
    const indent = 8 + depth * 14;
    const catCards = catNotes.flatMap((n) => cardsOfNote(n.id));
    const associatedCards = cardsOfCategory(c.id, catNotes);
    const topicSubject = topicsMap.data;
    const mismatchedCards = c.is_mirror
      ? associatedCards.filter((card) =>
          c.topic_id
            ? card.topic_id !== c.topic_id
            : c.subject_id && topicSubject
              ? (card.topic_id ? topicSubject.get(card.topic_id) : undefined) !== c.subject_id
              : false,
        )
      : [];

    return (
      <div key={c.id}>
        <div
          className={`w-full flex items-center rounded ${filter === c.id ? "bg-secondary" : "hover:bg-secondary/60"}`}
          style={{ paddingLeft: indent }}
        >
          <button
            type="button"
            onClick={() => toggleExpand(c.id)}
            className="p-1 text-muted-foreground"
            aria-label={expanded ? "Collapse" : "Expand"}
            title={expanded ? `Recolher ${c.name}` : `Expandir ${c.name}`}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter(c.id);
              toggleExpand(c.id);
            }}
            title={T("{name} — {a} anotação(ões), {b} flashcard(s), {c} mídia(s)", {
              name: c.name,
              a: catNotes.length,
              b: catCards.length,
              c: catMedia.length,
            })}
            className="flex-1 min-w-0 text-left px-1 py-1.5 flex items-center gap-2"
          >
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{c.name}</span>
          </button>
          {!c.is_mirror && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setLinkTarget(c)}
              title={T(
                "Transformar {name} em matéria, assunto ou subtópico sem perder o conteúdo",
                { name: c.name },
              )}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" /> {T("Vincular")}
            </Button>
          )}
          {mismatchedCards.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setSyncTarget({ cat: c, count: mismatchedCards.length })}
              title={T("Sincronizar {n} flashcard(s) com esta matéria/assunto", {
                n: mismatchedCards.length,
              })}
              aria-label={`Sincronizar ${mismatchedCards.length} flashcards com ${c.name}`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <button
            type="button"
            onClick={() => setAddTarget({ categoryId: c.id, noteId: null })}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label={s.notes.addMedia}
            title={`${s.notes.addMedia} — ${c.name}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {expanded && (
          <>
            {subs.map((s) => renderCat(s, depth + 1))}
            {catNotes.map((n) => noteRow(n, indent + 20))}
            {catMedia.map((m) => mediaRow(m, indent + 26))}
            {catNotes.length === 0 && catMedia.length === 0 && subs.length === 0 && (
              <p
                className="text-xs text-muted-foreground py-1"
                style={{ paddingLeft: indent + 26 }}
              >
                {s.notes.empty}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-serif">{t.notes.title}</h1>
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={create.isPending}
            title={s.notes.newNote}
          >
            <Plus className="h-4 w-4 mr-1" /> {t.notes.new}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="min-w-0 flex-1 whitespace-normal"
            onClick={() => setBulkOpen(true)}
            title={s.notes.bulkFormat}
          >
            <Sparkles className="h-4 w-4 mr-1 shrink-0" /> <span className="min-w-0">{s.notes.bulkFormatBtn}</span>
          </Button>
          <Button size="sm" variant="outline" className="min-w-0 flex-1 whitespace-normal" asChild title={s.notes.apostila}>
            <Link to="/apostila">
              <Printer className="h-4 w-4 mr-1 shrink-0" /> <span className="min-w-0">{s.notes.apostilaBtn}</span>
            </Link>
          </Button>
        </div>

        {/* Category tree */}
        <div className="rounded-xl border border-border bg-card/50 p-2 space-y-0.5 text-sm">
          <button
            type="button"
            onClick={() => setFilter(FILTER_ALL)}
            title={s.notes.allNotes}
            className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 ${filter === FILTER_ALL ? "bg-secondary" : "hover:bg-secondary/60"}`}
          >
            <span className="w-5" />
            <FolderTree className="h-3.5 w-3.5 text-muted-foreground" />
            {t.notes.allNotes}
          </button>
          <button
            type="button"
            onClick={() => setFilter(FILTER_UNCAT)}
            title={s.notes.noCategory}
            className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 ${filter === FILTER_UNCAT ? "bg-secondary" : "hover:bg-secondary/60"}`}
          >
            <span className="w-5" />
            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
            {t.notes.uncategorized}
          </button>

          {mirrorTopCats.map((c) => renderCat(c, 0))}
          {ownTopCats.length > 0 && (
            <p
              className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-2 pt-2"
              title={s.notes.myCategories}
            >
              {s.notes.myCategoriesLabel}
            </p>
          )}
          {ownTopCats.map((c) => renderCat(c, 0))}
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            title={T("Criar, renomear, vincular ou excluir categorias")}
            className="w-full text-left px-2 py-1.5 rounded flex items-center gap-2 text-muted-foreground hover:bg-secondary/60 mt-1"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            {t.notes.manageCategories}
          </button>
        </div>

        {/* Arquivos — lista agrupada numa div fixa na parte de baixo */}
        <div className="rounded-xl border border-border bg-card/50 p-2 space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              {s.notes.files}
            </span>
            <Select value={listFilter} onValueChange={setListFilter}>
              <SelectTrigger className="h-8 text-xs min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value={FILTER_ALL}>{s.notes.all}</SelectItem>
                <SelectItem value={FILTER_UNCAT}>{t.notes.uncategorized}</SelectItem>
                {topCats.map((c) => (
                  <Fragment key={c.id}>
                    <SelectItem value={c.id}>{c.name}</SelectItem>
                    {subsOf(c.id).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {"\u00A0\u00A0"}› {s.name}
                      </SelectItem>
                    ))}
                  </Fragment>
                ))}
              </SelectContent>
            </Select>
          </div>

          {notes.isLoading ? (
            <p className="text-sm text-muted-foreground px-1 py-2">{t.common.loading}</p>
          ) : listNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1 py-2">{t.notes.empty}</p>
          ) : (
            <ul className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
              {listNotes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => selectNote(n)}
                    className={`group w-full text-left rounded-lg px-2 py-1.5 border transition flex items-start gap-2 ${
                      selectedId === n.id
                        ? "bg-secondary border-border"
                        : "border-transparent hover:bg-secondary/60"
                    }`}
                  >
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title || t.notes.untitled}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {catLabel(n.category_id)} ·{" "}
                        {format(new Date(n.updated_at), "dd/MM HH:mm", { locale })}
                      </p>
                    </div>
                    {n.source_id && !isAppManager ? (
                      <span
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground p-1"
                        title={purchasedTexts.cannotDeleteItem}
                        aria-label={purchasedTexts.cannotDeleteItem}
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t.notes.confirmRemove)) remove.mutate(n.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            if (confirm(t.notes.confirmRemove)) remove.mutate(n.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                        aria-label={t.common.remove}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Painel de conteúdo — desktop */}
      <section className="space-y-3 hidden md:block">{contentBody()}</section>

      {/* Painel de conteúdo — mobile (modal sobreposto) */}
      <Dialog open={isMobile && mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="w-screen max-w-none h-[100dvh] sm:max-w-none p-3 pt-10 overflow-y-auto rounded-none">
          <div className="space-y-3">{contentBody()}</div>
        </DialogContent>
      </Dialog>

      <AddMediaDialog
        target={addTarget}
        onOpenChange={(o) => {
          if (!o) setAddTarget(null);
        }}
        onSubmit={(p) => addMedia.mutate(p)}
        pending={addMedia.isPending}
      />

      <ManageCategoriesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        cats={cats.data ?? []}
      />

      {linkTarget && (
        <LinkCategoryDialog
          cat={linkTarget}
          cats={cats.data ?? []}
          onClose={() => setLinkTarget(null)}
          onDone={() => {
            setLinkTarget(null);
            qc.invalidateQueries({ queryKey: ["note_categories"] });
            qc.invalidateQueries({ queryKey: ["notes"] });
            qc.invalidateQueries({ queryKey: ["note_card_media"] });
            qc.invalidateQueries({ queryKey: ["note_linked_cards"] });
            qc.invalidateQueries({ queryKey: ["flashcards"] });
          }}
        />
      )}

      <AlertDialog
        open={Boolean(syncTarget)}
        onOpenChange={(open) => {
          if (!open) setSyncTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{s.notes.syncTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {syncTarget
                ? T(
                    "{n} flashcard(s) vinculados às anotações de “{name}” estão classificados em outros assuntos. Eles serão movidos para este assunto sem alterar perguntas, respostas ou progresso.",
                    { n: syncTarget.count, name: syncTarget.cat.name },
                  )
                : T("Os flashcards serão classificados no assunto correspondente.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncCategoryCards.isPending}>
              {s.notes.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={syncCategoryCards.isPending || !syncTarget}
              onClick={(event) => {
                event.preventDefault();
                if (syncTarget) syncCategoryCards.mutate(syncTarget.cat.id);
              }}
            >
              {syncCategoryCards.isPending ? s.notes.syncing : s.notes.sync}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiFormatNoteDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        noteId={selectedId}
        title={title}
        html={content}
        onApplied={(html) => {
          setContent(html);
          setDirty(false);
          qc.invalidateQueries({ queryKey: ["notes"] });
        }}
      />

      <GenerateMindMapDialog
        open={mindMapOpen}
        onOpenChange={setMindMapOpen}
        source={selectedId ? { kind: "note", noteId: selectedId, title, categoryId } : null}
      />

      <BulkFormatNotesDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        notes={notes.data ?? []}
        cats={cats.data ?? []}
        onDone={() => qc.invalidateQueries({ queryKey: ["notes"] })}
      />
    </div>
  );
}

function ManageCategoriesDialog({
  open,
  onOpenChange,
  cats,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cats: Cat[];
}) {
  const t = useT();
  const s = useScreenT();
  const { lang } = useLang();
  const purchasedTexts = usePurchasedTexts(lang);
  const { isAppManager } = usePlanLimit();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("__none__");
  const [linkTarget, setLinkTarget] = useState<Cat | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["note_categories"] });
    qc.invalidateQueries({ queryKey: ["notes-picker"] });
    qc.invalidateQueries({ queryKey: ["notes"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      const { error } = await supabase.from("note_categories").insert({
        user_id: u.user.id,
        name: name.trim(),
        parent_id: parentId === "__none__" ? null : parentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.notes.categoryCreated);
      setName("");
      setParentId("__none__");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const cat = cats.find((x) => x.id === id);
      if (cat?.source_id && !isAppManager) throw new Error(purchasedTexts.cannotDeleteItem);
      const { error } = await supabase.from("note_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.notes.categoryRemoved);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const rename = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const { error } = await supabase
        .from("note_categories")
        .update({ name: newName })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.notes.categoryRenamed);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const unlink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("note_categories")
        .update({ subject_id: null, topic_id: null, parent_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(T("Categoria desvinculada"));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  function askRename(id: string, current: string) {
    const next = prompt(t.notes.renameCategoryPrompt, current);
    if (next && next.trim() && next.trim() !== current) {
      rename.mutate({ id, newName: next.trim() });
    }
  }

  const topCats = cats.filter((c) => !c.parent_id);
  const subsOf = (id: string) => cats.filter((c) => c.parent_id === id);

  function renderRow(c: Cat, depth: number) {
    const mirror = !!c.is_mirror;
    return (
      <div key={c.id}>
        <div
          className="flex items-center justify-between pr-2 py-1 rounded hover:bg-secondary/60"
          style={{ paddingLeft: 8 + depth * 20 }}
        >
          <span className={`text-sm flex items-center gap-2 ${depth === 0 ? "font-medium" : ""}`}>
            <Folder
              className={`${depth === 0 ? "h-3.5 w-3.5" : "h-3 w-3"} text-muted-foreground`}
            />
            {c.name}
            {mirror && (
              <span className="text-[10px] text-muted-foreground border border-border rounded px-1">
                {c.subject_id ? s.notes.subject : s.notes.topic}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1">
            {mirror ? (
              <Button
                variant="ghost"
                size="sm"
                title={T("Desvincular (mantém o conteúdo)")}
                onClick={() => {
                  if (confirm(s.notes.unlinkConfirm)) unlink.mutate(c.id);
                }}
              >
                <Unlink className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  title={T("Vincular a matéria/assunto…")}
                  onClick={() => setLinkTarget(c)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => askRename(c.id, c.name)}
                  aria-label={t.notes.rename}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {c.source_id && !isAppManager ? (
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground"
                    title={purchasedTexts.cannotDeleteItem}
                    aria-label={purchasedTexts.cannotDeleteItem}
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(t.notes.confirmRemoveCategory)) remove.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        {subsOf(c.id).map((s) => renderRow(s, depth + 1))}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t.notes.manageCategories}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.notes.categoryName}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.notes.categoryNamePh}
            />
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.notes.rootCategoryOption}</SelectItem>
                {topCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {t.notes.subcategoryOf(c.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => create.mutate()}
              disabled={!name.trim() || create.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              {parentId === "__none__" ? t.notes.newCategory : t.notes.newSubcategory}
            </Button>
          </div>

          <div className="border-t border-border pt-3 max-h-[300px] overflow-y-auto space-y-1">
            {topCats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t.notes.categories} —
              </p>
            )}
            {topCats.map((c) => renderRow(c, 0))}
          </div>
          <p className="text-xs text-muted-foreground">
            {T(
              "Categorias vinculadas a matérias/assuntos são renomeadas e excluídas na tela de matérias.",
            )}
          </p>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t.common.back}
          </Button>
        </DialogFooter>

        {linkTarget && (
          <LinkCategoryDialog
            cat={linkTarget}
            cats={cats}
            onClose={() => setLinkTarget(null)}
            onDone={() => {
              setLinkTarget(null);
              invalidate();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type LinkOption = {
  kind: "subject" | "topic";
  id: string;
  label: string;
  officialName: string;
  score: number;
};

function normTxt(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function scoreName(query: string, target: string): number {
  const q = normTxt(query);
  const x = normTxt(target);
  if (!q || !x) return 0;
  if (x === q) return 100;
  if (x.includes(q) || q.includes(x)) return 80;
  const qTok = new Set(q.split(/\s+/).filter((w) => w.length > 2));
  const xTok = new Set(x.split(/\s+/).filter((w) => w.length > 2));
  if (qTok.size === 0 || xTok.size === 0) return 0;
  let hit = 0;
  qTok.forEach((w) => {
    if (xTok.has(w)) hit++;
  });
  return Math.round((hit / Math.max(qTok.size, xTok.size)) * 60);
}

function LinkCategoryDialog({
  cat,
  cats,
  onClose,
  onDone,
}: {
  cat: Cat;
  cats: Cat[];
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const s = useScreenT();
  const [search, setSearch] = useState(cat.name);
  const [newName, setNewName] = useState(cat.name);
  const [newParent, setNewParent] = useState<string>("__root__");

  const options = useQuery({
    queryKey: ["link-category-options"],
    queryFn: async () => {
      const [subs, tops] = await Promise.all([
        supabase.from("subjects").select("id, name").order("name"),
        supabase.from("topics").select("id, name, subject_id, parent_id"),
      ]);
      if (subs.error) throw subs.error;
      if (tops.error) throw tops.error;
      const subjById = new Map((subs.data ?? []).map((s) => [s.id, s.name]));
      const topById = new Map((tops.data ?? []).map((x) => [x.id, x]));
      const pathOf = (tp: {
        id: string;
        name: string;
        subject_id: string;
        parent_id: string | null;
      }): string => {
        const parts = [tp.name];
        let cur = tp;
        let guard = 0;
        while (cur.parent_id && guard++ < 8) {
          const p = topById.get(cur.parent_id);
          if (!p) break;
          parts.unshift(p.name);
          cur = p;
        }
        const subj = subjById.get(tp.subject_id);
        if (subj) parts.unshift(subj);
        return parts.join(" › ");
      };
      const out: LinkOption[] = [];
      (subs.data ?? []).forEach((s) =>
        out.push({
          kind: "subject",
          id: s.id,
          label: `📚 ${s.name}`,
          officialName: s.name,
          score: 0,
        }),
      );
      (tops.data ?? []).forEach((tp) =>
        out.push({ kind: "topic", id: tp.id, label: pathOf(tp), officialName: tp.name, score: 0 }),
      );
      return out;
    },
  });

  const ranked = useMemo(() => {
    const opts = (options.data ?? []).map((o) => ({
      ...o,
      score: scoreName(cat.name, o.officialName),
    }));
    const filtered = search.trim()
      ? opts.filter((o) => normTxt(o.label).includes(normTxt(search)) || o.score > 0)
      : opts;
    return filtered
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 40);
  }, [options.data, search, cat.name]);

  const link = useMutation({
    mutationFn: async (opt: LinkOption) => {
      const { error } = await supabase.rpc("link_note_category_to_official", {
        p_category_id: cat.id,
        p_subject_id: opt.kind === "subject" ? opt.id : undefined,
        p_topic_id: opt.kind === "topic" ? opt.id : undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(T("Categoria vinculada — todo o conteúdo foi mantido"));
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : T("Falha ao vincular")),
  });

  const createOfficial = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Informe o nome");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const uid = u.user.id;

      let newSubjectId: string | null = null;
      let newTopicId: string | null = null;
      if (newParent === "__root__") {
        const { data, error } = await supabase
          .from("subjects")
          .insert({ user_id: uid, name })
          .select("id")
          .single();
        if (error) throw error;
        newSubjectId = data.id;
      } else {
        const [kind, pid] = newParent.split(":");
        let subjectId = pid;
        let parentTopicId: string | null = null;
        if (kind === "topic") {
          const { data: tp, error } = await supabase
            .from("topics")
            .select("subject_id")
            .eq("id", pid)
            .single();
          if (error) throw error;
          subjectId = tp.subject_id;
          parentTopicId = pid;
        }
        const { data, error } = await supabase
          .from("topics")
          .insert({ user_id: uid, name, subject_id: subjectId, parent_id: parentTopicId })
          .select("id")
          .single();
        if (error) throw error;
        newTopicId = data.id;
      }

      const { error: linkErr } = await supabase.rpc("link_note_category_to_official", {
        p_category_id: cat.id,
        p_subject_id: newSubjectId ?? undefined,
        p_topic_id: newTopicId ?? undefined,
      });
      if (linkErr) throw linkErr;
    },
    onSuccess: () => {
      toast.success(newParent === "__root__" ? s.notes.subjectCreated : s.notes.topicCreated);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      qc.invalidateQueries({ queryKey: ["link-category-options"] });
      qc.invalidateQueries({ queryKey: ["flashcards"] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : T("Falha ao criar")),
  });

  const busy = link.isPending || createOfficial.isPending;

  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{T('Vincular "{name}"', { name: cat.name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium">{s.notes.createNew}</p>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={T("Nome oficial")}
            />
            <Select value={newParent} onValueChange={setNewParent}>
              <SelectTrigger>
                <SelectValue placeholder={T("Onde criar")} />
              </SelectTrigger>
              <SelectContent className="max-h-[260px]">
                <SelectItem value="__root__">{s.notes.createAsSubject}</SelectItem>
                <SelectGroup>
                  <SelectLabel>{s.notes.createInside}</SelectLabel>
                  {(options.data ?? []).map((o) => (
                    <SelectItem key={`${o.kind}-${o.id}`} value={`${o.kind}:${o.id}`}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={busy || !newName.trim()}
              onClick={() => createOfficial.mutate()}
            >
              {newParent === "__root__"
                ? T('Criar matéria "{name}"', { name: newName.trim() || "…" })
                : T('Criar assunto "{name}"', { name: newName.trim() || "…" })}
            </Button>
          </div>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={s.notes.linkExisting}
          />

          <p className="text-xs text-muted-foreground">
            {T(
              "Ao vincular, a categoria passa a exibir o nome oficial e mantém todas as anotações, imagens, vídeos e flashcards.",
            )}
          </p>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {options.isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{s.notes.loading}</p>
            ) : ranked.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {s.notes.nothingFound}
              </p>
            ) : (
              ranked.map((o) => (
                <button
                  key={`${o.kind}-${o.id}`}
                  type="button"
                  disabled={busy}
                  onClick={() => link.mutate(o)}
                  className="w-full text-left text-sm rounded-lg border border-border px-3 py-2 hover:bg-secondary/60 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{o.label}</span>
                  {o.score > 0 && (
                    <span className="text-[10px] text-muted-foreground shrink-0">{o.score}%</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {s.notes.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AddPayload = {
  kind: "image" | "video";
  title: string;
  file?: File | null;
  url?: string | null;
  categoryId: string | null;
  noteId: string | null;
};

function AddMediaDialog({
  target,
  onOpenChange,
  onSubmit,
  pending,
}: {
  target: { categoryId: string | null; noteId: string | null } | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (p: AddPayload) => void;
  pending: boolean;
}) {
  const s = useScreenT();
  const [kind, setKind] = useState<"image" | "video">("image");
  const [mediaTitle, setMediaTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (target) {
      setKind("image");
      setMediaTitle("");
      setVideoUrl("");
      setFile(null);
    }
  }, [target]);

  const validVideo = kind === "video" && !!parseYouTubeId(videoUrl);
  const canSave = kind === "image" ? !!file : validVideo;

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{s.notes.addContent}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={kind === "image" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setKind("image")}
            >
              <ImageIcon className="h-4 w-4 mr-1" /> {T("Imagem")}
            </Button>
            <Button
              type="button"
              variant={kind === "video" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setKind("video")}
            >
              <Video className="h-4 w-4 mr-1" /> {T("Vídeo")}
            </Button>
          </div>

          <Input
            value={mediaTitle}
            onChange={(e) => setMediaTitle(e.target.value)}
            placeholder={kind === "image" ? s.notes.imageTitle : s.notes.videoTitle}
          />

          {kind === "image" ? (
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm cursor-pointer hover:bg-secondary/50">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {file ? file.name : T("Selecionar imagem do dispositivo")}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <div className="space-y-1">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={T("Cole o link do YouTube")}
              />
              {videoUrl && !validVideo && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" /> {T("Link do YouTube inválido")}
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {s.notes.cancel}
          </Button>
          <Button
            disabled={!canSave || pending}
            onClick={() =>
              onSubmit({
                kind,
                title: mediaTitle,
                file,
                url: videoUrl,
                categoryId: target?.categoryId ?? null,
                noteId: target?.noteId ?? null,
              })
            }
          >
            {pending ? T("Salvando…") : T("Adicionar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
