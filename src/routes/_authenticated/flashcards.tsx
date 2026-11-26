import { createFileRoute, Link } from "@tanstack/react-router";
import { T } from "@/lib/i18n-ui";
import { pageHead } from "@/lib/page-head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { VoiceInput } from "@/components/VoiceInput";
import { MicButton } from "@/components/MicButton";
import { Checkbox } from "@/components/ui/checkbox";
import { NoteLinkPicker } from "@/components/NoteLinkPicker";
import { MindMapPicker } from "@/components/MindMapPicker";
import { VideoLinksPicker } from "@/components/VideoLinksPicker";
import { BulkAttachDialog } from "@/components/BulkAttachDialog";
import { toast } from "sonner";
import {
  Pencil,
  Trash2,
  FileSpreadsheet,
  BookOpen,
  FileText,
  Search,
  List,
  Star,
  FolderInput,
  Loader2,
  Link2,
  Image as ImageIcon,
  Video,
  BookMarked,
  Timer,
  Lock,
} from "lucide-react";
import { PrazoScanDialog } from "@/components/PrazoScanDialog";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Languages, Network } from "lucide-react";
import { GenerateMindMapDialog } from "@/components/GenerateMindMapDialog";

import { useServerFn } from "@tanstack/react-start";
import { notebooksForCard, listNotebooks, notebookScope } from "@/lib/notebooks.functions";
import { AddToNotebookDialog } from "@/components/AddToNotebookDialog";
import { useLang, useT } from "@/lib/i18n";
import { useScreenT } from "@/lib/i18n-screens";
import { usePurchasedTexts } from "@/lib/i18n-purchased";
import { translateMicrocopy } from "@/lib/i18n-microcopy";
import * as XLSX from "@e965/xlsx";
import { exportFlashcardsReportPdf } from "@/lib/export-report-pdf";
import { usePlanLimit } from "@/lib/plan-limit";
import { todayLocal } from "@/lib/today";
import { flattenCategoryTree } from "@/lib/note-category-tree";
import {
  descendantsOf,
  flattenTopicTree,
  indentTopicLabel,
  topicDisplayName,
} from "@/lib/topic-tree";
import { renumber } from "@/lib/order-index";
import { persistCardOrder } from "@/lib/reorder-cards";
import { sortBySourceOrder } from "@/lib/study-source-order";
import { SortableList, SortableItem } from "@/components/SortableList";

export const Route = createFileRoute("/_authenticated/flashcards")({
  head: () =>
    pageHead(
      "Meus flashcards — FlashPilot",
      "Encontre e organize seus flashcards para revisar no FlashPilot.",
    ),
  component: FlashcardsListPage,
});

type Row = {
  id: string;
  question: string;
  answer: string;
  due_date: string;
  repetitions: number;
  is_favorite: boolean;
  reviewed: boolean;
  order_index: number | null;
  created_at: string;
  linked_note_id: string | null;
  image_url: string | null;
  video_url_1?: string | null;
  video_url_2?: string | null;
  image_category_id: string | null;
  topic_id: string;
  source_id?: string | null;
  topics: {
    id: string;
    name: string;
    subject_id: string;
    order_index: number | null;
    created_at: string;
    subjects: { id: string; name: string } | null;
  } | null;
};

const ALL_SENTINEL = 1_000_000;
const PAGE_SIZES: Array<number> = [10, 25, 50, 100, 200, ALL_SENTINEL];

function FlashcardsListPage() {
  const t = useT();
  const sc = useScreenT();
  const { lang, extLang } = useLang();
  const purchasedTexts = usePurchasedTexts(lang);
  const tr = (source: string) => translateMicrocopy(source, lang);
  const exportTr = (source: string) => (extLang ? T(source) : tr(source));
  const qc = useQueryClient();

  const plan = usePlanLimit();

  const [prazoScanOpen, setPrazoScanOpen] = useState(false);
  const [mindMapOpen, setMindMapOpen] = useState(false);

  const [subjectId, setSubjectId] = useState<string>("all");
  const [topicId, setTopicId] = useState<string>("all");
  const [subtopicId, setSubtopicId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [reviewedFilter, setReviewedFilter] = useState<"all" | "yes" | "no">("all");
  const [notebookId, setNotebookId] = useState<string>("all");
  const [onlyDirectTopic, setOnlyDirectTopic] = useState(false);

  const subjects = useQuery({
    queryKey: ["fc-list-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const topics = useQuery({
    queryKey: ["fc-list-topics", subjectId],
    queryFn: async () => {
      let q = supabase
        .from("topics")
        .select("id, name, article_range, subject_id, parent_id, order_index, created_at")
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (subjectId !== "all") q = q.eq("subject_id", subjectId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        name: string;
        article_range: string | null;
        subject_id: string;
        parent_id: string | null;
        order_index: number | null;
        created_at: string;
      }[];
    },
  });

  const notebooksListFn = useServerFn(listNotebooks);
  const notebooksList = useQuery({
    queryKey: ["fc-flash-sessions"],
    queryFn: () => notebooksListFn({ data: undefined } as any),
  });

  const notebookScopeFn = useServerFn(notebookScope);
  const notebookScopeData = useQuery({
    queryKey: ["fc-flash-session-scope", notebookId],
    enabled: notebookId !== "all",
    queryFn: () => notebookScopeFn({ data: { id: notebookId } }),
  });

  // Assuntos: árvore completa (todos os níveis), indentada.
  const parentTopics = useMemo(() => flattenTopicTree(topics.data ?? []), [topics.data]);
  // Subitens: todos os descendentes do assunto selecionado, em qualquer nível.
  const subtopics = useMemo(() => {
    if (topicId === "all") return [];
    const rows = topics.data ?? [];
    const desc = descendantsOf(rows, topicId);
    desc.delete(topicId);
    return flattenTopicTree(rows.filter((tp) => desc.has(tp.id)));
  }, [topics.data, topicId]);

  // Criar novo assunto direto no select
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const createTopic = useMutation({
    mutationFn: async () => {
      const name = newTopicName.trim();
      if (!name) throw new Error(sc.fc.topicNameRequired);
      if (subjectId === "all") throw new Error(sc.fc.pickSubjectFirst);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(T("Não autenticado"));
      const { data, error } = await supabase
        .from("topics")
        .insert({ name, subject_id: subjectId, user_id: u.user.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: async (id) => {
      toast.success(T("Assunto criado"));
      setNewTopicOpen(false);
      setNewTopicName("");
      await qc.invalidateQueries({ queryKey: ["fc-list-topics"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      setTopicId(id);
      setSubtopicId("all");
      setPage(1);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : T("Erro ao criar assunto")),
  });

  const cards = useQuery({
    queryKey: ["fc-list-all"],
    queryFn: async () => {
      // Supabase limita cada request a 1000 linhas. Paginamos com .range()
      // até esgotar para não perder cards antigos quando o total ultrapassa 1000.
      const PAGE = 1000;
      const all: Row[] = [];
      let from = 0;
      // Loop com limite alto de segurança para evitar loop infinito.
      for (let i = 0; i < 100; i++) {
        const { data, error } = await supabase
          .from("flashcards")
          .select(
            "id, question, answer, due_date, repetitions, is_favorite, reviewed, order_index, created_at, linked_note_id, image_url, image_category_id, video_url_1, video_url_2, topic_id, source_id, topics!inner(id, name, article_range, subject_id, order_index, created_at, subjects(id, name))",
          )
          .order("order_index", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const batch = (data ?? []) as unknown as Row[];
        all.push(...batch);
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      return all;
    },
  });

  // Títulos das anotações vinculadas (usados nas exportações)
  const notesTitlesQuery = useQuery({
    queryKey: ["fc-note-titles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("id, title").limit(5000);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; title: string }>;
    },
  });
  const noteTitles = useMemo(
    () => new Map((notesTitlesQuery.data ?? []).map((n) => [n.id, n.title])),
    [notesTitlesQuery.data],
  );
  // Categorias das imagens (mapas mentais) — usadas para nomear os arquivos
  const mapCatsQuery = useQuery({
    queryKey: ["fc-mindmap-cats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_categories")
        .select("id, name, parent_id")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; parent_id: string | null }>;
    },
  });
  const catPaths = useMemo(() => {
    const opts = flattenCategoryTree((mapCatsQuery.data ?? []) as any);
    return new Map(opts.map((o) => [o.id, o.path]));
  }, [mapCatsQuery.data]);

  function mindMapName(r: Row) {
    if (!r.image_url) return "";
    const ext = (r.image_url.split(".").pop() ?? "").toLowerCase().match(/^[a-z0-9]+$/)?.[0] ?? "";
    const base =
      (r.image_category_id ? catPaths.get(r.image_category_id) : null) ??
      breadcrumbFor(r) ??
      T("Mapa mental");
    return `Mapa mental — ${base}${ext ? ` (.${ext})` : ""}`;
  }

  const filtered = useMemo(() => {
    let list = cards.data ?? [];
    if (onlyFavorites) list = list.filter((r) => r.is_favorite);
    if (reviewedFilter === "yes") list = list.filter((r) => r.reviewed);
    if (reviewedFilter === "no") list = list.filter((r) => !r.reviewed);
    if (subjectId !== "all") list = list.filter((r) => r.topics?.subject_id === subjectId);
    if (topicId !== "all") {
      if (subtopicId !== "all") {
        list = list.filter((r) => r.topic_id === subtopicId);
      } else if (onlyDirectTopic) {
        list = list.filter((r) => r.topic_id === topicId);
      } else {
        // inclui todos os níveis abaixo (subtópicos, subitens, etc.)
        const ids = descendantsOf(topics.data ?? [], topicId);
        list = list.filter((r) => ids.has(r.topic_id));
      }
    }

    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (r) => r.question.toLowerCase().includes(s) || r.answer.toLowerCase().includes(s),
      );
    }
    if (notebookId !== "all" && notebookScopeData.data) {
      const topicSet = new Set(notebookScopeData.data.topicIds);
      const cardSet = new Set(notebookScopeData.data.cardIds);
      list = list.filter((r) => topicSet.has(r.topic_id) || cardSet.has(r.id));
    }
    return list;
  }, [
    cards.data,
    subjectId,
    topicId,
    subtopicId,
    search,
    onlyFavorites,
    onlyDirectTopic,
    reviewedFilter,
    topics.data,
    notebookId,
    notebookScopeData.data,
  ]);

  // A lista e todas as exportações seguem a hierarquia da fonte, nunca os nomes.
  // Usada tanto na exibição quanto nas exportações (CSV/XLSX/PDF).
  const topicMap = useMemo(
    () => new Map((topics.data ?? []).map((tp) => [tp.id, tp])),
    [topics.data],
  );

  const hierPath = useCallback(
    (r: Row): string[] => {
      const parts: string[] = [];
      let cur = topicMap.get(r.topic_id);
      let guard = 0;
      while (cur && guard++ < 10) {
        parts.unshift(topicDisplayName(cur));
        cur = cur.parent_id ? topicMap.get(cur.parent_id) : undefined;
      }
      if (parts.length === 0 && r.topics?.name) parts.push(topicDisplayName(r.topics));
      return parts;
    },
    [topicMap],
  );

  const sortedFiltered = useMemo(() => {
    return sortBySourceOrder(filtered.map((row) => {
      if (!row.topics) return row;
      const sourceAncestors = [];
      const seen = new Set<string>([row.topic_id]);
      let parentId = topicMap.get(row.topic_id)?.parent_id;
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        const parent = topicMap.get(parentId);
        if (!parent) break;
        sourceAncestors.unshift(parent);
        parentId = parent.parent_id;
      }
      return { ...row, topics: { ...row.topics, sourceAncestors } };
    }));
  }, [filtered, topicMap]);

  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = sortedFiltered.slice(start, start + pageSize);

  // Group by subject > topic for display
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { subjectName: string; topics: Map<string, { topicName: string; rows: Row[] }> }
    >();
    for (const r of pageRows) {
      const sName = r.topics?.subjects?.name ?? "—";
      const sId = r.topics?.subject_id ?? "none";
      const tName = r.topics ? topicDisplayName(r.topics) : "—";
      const tId = r.topic_id;
      if (!map.has(sId)) map.set(sId, { subjectName: sName, topics: new Map() });
      const s = map.get(sId)!;
      if (!s.topics.has(tId)) s.topics.set(tId, { topicName: tName, rows: [] });
      s.topics.get(tId)!.rows.push(r);
    }
    return map;
  }, [pageRows]);

  // Um grupo só pode ser arrastado se todos os cards daquele tópico (após
  // filtros) estiverem visíveis nesta página — senão a reordenação seria parcial.
  const draggableTopics = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of sortedFiltered) totals.set(r.topic_id, (totals.get(r.topic_id) ?? 0) + 1);
    const onPage = new Map<string, number>();
    for (const r of pageRows) onPage.set(r.topic_id, (onPage.get(r.topic_id) ?? 0) + 1);
    const set = new Set<string>();
    for (const [tid, n] of onPage) if (totals.get(tid) === n) set.add(tid);
    return set;
  }, [sortedFiltered, pageRows]);

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      await persistCardOrder(ids);
    },
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ["fc-list-all"] });
      const prev = qc.getQueryData<Row[]>(["fc-list-all"]);
      if (prev) {
        const orderById = new Map(renumber(ids).map((r) => [r.id, r.order_index]));
        qc.setQueryData<Row[]>(
          ["fc-list-all"],
          prev.map((r) => (orderById.has(r.id) ? { ...r, order_index: orderById.get(r.id)! } : r)),
        );
      }
      return { prev };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(["fc-list-all"], ctx.prev);
      toast.error(e instanceof Error ? e.message : sc.fc.orderSaveFail);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
  });

  function breadcrumbFor(r: Row): string | null {
    const parts: string[] = [];
    if (r.topics?.subjects?.name) parts.push(r.topics.subjects.name);
    const path = hierPath(r);
    if (path.length) parts.push(...path);
    return parts.length ? parts.join(" › ") : null;
  }

  // Edit dialog
  const [editing, setEditing] = useState<Row | null>(null);
  const [notebookIds, setNotebookIds] = useState<string[]>([]);
  const notebooksForCardFn = useServerFn(notebooksForCard);
  const cardNotebooks = useQuery({
    queryKey: ["notebooks-for-card", editing?.id],
    enabled: !!editing?.id,
    queryFn: () => notebooksForCardFn({ data: { flashcardId: editing!.id } }),
  });
  const [eQ, setEQ] = useState("");
  const [eA, setEA] = useState("");
  const [eOrder, setEOrder] = useState<string>("");
  const [eLinked, setELinked] = useState<string | null>(null);
  const [eImagePath, setEImagePath] = useState<string | null>(null);
  const [eImageCat, setEImageCat] = useState<string | null>(null);
  const [eVideo1, setEVideo1] = useState<string | null>(null);
  const [eVideo2, setEVideo2] = useState<string | null>(null);

  function openEdit(r: Row) {
    setEditing(r);
    setEQ(r.question);
    setEA(r.answer);
    setEOrder(r.order_index != null ? String(r.order_index) : "");
    setELinked(r.linked_note_id);
    setEImagePath(r.image_url);
    setEImageCat(r.image_category_id);
    setEVideo1(r.video_url_1 ?? null);
    setEVideo2(r.video_url_2 ?? null);
  }

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const parsed = eOrder.trim() === "" ? null : parseInt(eOrder, 10);
      const { error } = await supabase
        .from("flashcards")
        .update({
          question: eQ.trim(),
          answer: eA.trim(),
          order_index: Number.isFinite(parsed as number) ? parsed : null,
          linked_note_id: eLinked,
          image_url: eImagePath,
          image_category_id: eImageCat,
          video_url_1: eVideo1,
          video_url_2: eVideo2,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.flashLink.cardUpdated);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const row = (cards.data ?? []).find((c: any) => c.id === id);
      if (row?.source_id && !plan.isAppManager) throw new Error(purchasedTexts.cannotDeleteItem);
      const { error } = await supabase.from("flashcards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      toast.success(t.topic.removed);
    },
  });

  // ---- Seleção múltipla ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggleSel(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function clearSel() {
    setSelected(new Set());
  }

  const [confirmDelBulk, setConfirmDelBulk] = useState(false);
  const [bulkAttach, setBulkAttach] = useState<null | "note" | "image" | "video">(null);

  // ---- Definir idioma em lote ----
  const [langOpen, setLangOpen] = useState(false);
  const [bulkLang, setBulkLang] = useState<string | null>(null);
  const setLangBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { error } = await supabase
          .from("flashcards")
          .update({ language: bulkLang })
          .in("id", ids.slice(i, i + CHUNK));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(T("Idioma atualizado"));
      setLangOpen(false);
      clearSel();
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const removeBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = (cards.data ?? []) as any[];
      const blocked = plan.isAppManager
        ? []
        : ids.filter((id) => rows.find((c) => c.id === id)?.source_id);
      const allowed = ids.filter((id) => !blocked.includes(id));
      if (allowed.length === 0) throw new Error(purchasedTexts.cannotDeleteItem);

      // Keep each PostgREST `in` filter small; a single request with thousands
      // of IDs can exceed URL/request limits.
      const CHUNK_SIZE = 200;
      for (let i = 0; i < allowed.length; i += CHUNK_SIZE) {
        const { error } = await supabase
          .from("flashcards")
          .delete()
          .in("id", allowed.slice(i, i + CHUNK_SIZE));
        if (error) throw error;
      }
      if (blocked.length > 0) toast.error(purchasedTexts.cannotDeleteItem);
    },
    onSuccess: () => {
      toast.success(sc.fc.deleted);
      setConfirmDelBulk(false);
      clearSel();
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["fc-list-topics"] });
      qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["favorites-count"] });
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["fc-list-topics"] });
      qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["favorites-count"] });
      toast.error(e instanceof Error ? e.message : t.common.error);
    },
  });

  // ---- Mover flashcard(s) para outra matéria/tópico ----
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveIds, setMoveIds] = useState<string[]>([]);
  const [mSubject, setMSubject] = useState<string>("");
  const [mTopic, setMTopic] = useState<string>("");

  const moveTopics = useQuery({
    queryKey: ["fc-move-topics", mSubject],
    enabled: !!mSubject,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, parent_id")
        .eq("subject_id", mSubject)
        .order("name");
      if (error) throw error;
      const rows = (data ?? []) as Array<{ id: string; name: string; parent_id: string | null }>;
      // Monta lista hierárquica (assunto → subtópicos), indentada
      const byParent = new Map<string | null, typeof rows>();
      const ids = new Set(rows.map((r) => r.id));
      for (const r of rows) {
        const key = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null;
        const arr = byParent.get(key) ?? [];
        arr.push(r);
        byParent.set(key, arr);
      }
      const out: Array<{ id: string; label: string; depth: number }> = [];
      const walk = (parent: string | null, depth: number) => {
        for (const r of (byParent.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
          out.push({ id: r.id, label: r.name, depth });
          walk(r.id, depth + 1);
        }
      };
      walk(null, 0);
      return out;
    },
  });

  function openMove(ids: string[]) {
    if (ids.length === 0) return;
    setMoveIds(ids);
    // pré-selecionar a matéria/tópico do primeiro card, se todos vierem do mesmo
    const first = (cards.data ?? []).find((r) => r.id === ids[0]);
    setMSubject(first?.topics?.subject_id ?? "");
    setMTopic(ids.length === 1 ? (first?.topic_id ?? "") : "");
    setMoveOpen(true);
  }

  const move = useMutation({
    mutationFn: async () => {
      if (moveIds.length === 0 || !mSubject) throw new Error(T("Selecione uma matéria"));
      let targetTopicId = mTopic;
      if (!targetTopicId || targetTopicId === "__geral__") {
        const { data: existing, error: eSel } = await supabase
          .from("topics")
          .select("id")
          .eq("subject_id", mSubject)
          .eq("name", "Geral")
          .maybeSingle();
        if (eSel) throw eSel;
        if (existing?.id) {
          targetTopicId = existing.id;
        } else {
          const { data: u } = await supabase.auth.getUser();
          if (!u.user) throw new Error(t.common.notAuth);
          const { data: created, error: eIns } = await supabase
            .from("topics")
            .insert({ user_id: u.user.id, subject_id: mSubject, name: "Geral" })
            .select("id")
            .single();
          if (eIns) throw eIns;
          targetTopicId = created.id;
        }
      }
      const { error } = await supabase
        .from("flashcards")
        .update({ topic_id: targetTopicId })
        .in("id", moveIds);
      if (error) throw error;
      return moveIds.length;
    },
    onSuccess: (n) => {
      toast.success(n === 1 ? T("Flashcard movido") : T("{n} flashcards movidos", { n }));
      setMoveOpen(false);
      setMoveIds([]);
      clearSel();
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["fc-list-topics"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const toggleFav = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase
        .from("flashcards")
        .update({ is_favorite: next })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, next }) => {
      await qc.cancelQueries({ queryKey: ["fc-list-all"] });
      const prev = qc.getQueryData<Row[]>(["fc-list-all"]);
      qc.setQueryData<Row[]>(["fc-list-all"], (old) =>
        (old ?? []).map((r) => (r.id === id ? { ...r, is_favorite: next } : r)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["fc-list-all"], ctx.prev);
      toast.error(t.common.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites-count"] }),
  });

  const toggleReviewed = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase
        .from("flashcards")
        .update({ reviewed: next, reviewed_marked_at: next ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, next }) => {
      await qc.cancelQueries({ queryKey: ["fc-list-all"] });
      const prev = qc.getQueryData<Row[]>(["fc-list-all"]);
      qc.setQueryData<Row[]>(["fc-list-all"], (old) =>
        (old ?? []).map((r) => (r.id === id ? { ...r, reviewed: next } : r)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["fc-list-all"], ctx.prev);
      toast.error(t.common.error);
    },
  });

  function exportRows() {
    // Usa exatamente a mesma sequência exibida na tela (matéria > assunto > subtópico).
    return sortedFiltered.map((r, i) => ({
      [exportTr("Ordem")]: r.order_index ?? i + 1,
      [t.flashcardsList.colSubject]: r.topics?.subjects?.name ?? "",
      [t.flashcardsList.colTopic]: hierPath(r).join(" > "),
      [t.flashcardsList.colQuestion]: r.question,
      [t.flashcardsList.colAnswer]: r.answer,
      [sc.fc.linkedNote]: r.linked_note_id ? (noteTitles.get(r.linked_note_id) ?? "") : "",
      [exportTr("Mapa mental")]: mindMapName(r),
      [t.flashcardsList.colDue]: r.due_date,
      [t.flashcardsList.colReps]: r.repetitions,
    }));
  }

  function exportExcel() {
    const rows = exportRows();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, T("Flashcards"));
    XLSX.writeFile(wb, `flashpilot-${todayLocal()}.xlsx`);
  }

  /**
   * CSV estrito de duas colunas, exclusivo do AppManager:
   * Face A = pergunta com as alternativas; Face B = somente a resposta.
   */
  function exportCsv() {
    if (!plan.isAppManager) return;
    const rows = sortedFiltered.map((r) => [r.question ?? "", r.answer ?? ""]);
    if (!rows.length) return;
    const esc = (v: unknown) => {
      const s = String(v ?? "").replace(/\r?\n/g, " ");
      return `"${s.replace(/"/g, '""')}"`;
    };
    const csv = [
      [T("Face A"), T("Face B")].map(esc).join(";"),
      ...rows.map((r) => r.map(esc).join(";")),
    ].join("\r\n");
    // BOM garante UTF-8 e acentuação correta no Excel
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flashpilot-${todayLocal()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Filtros aplicados, para aparecerem no cabeçalho do relatório em PDF. */
  function reportFilters() {
    const all = extLang ? sc.fc.all : tr("Todos");
    const allFem = extLang ? sc.fc.allFem : tr("Todas");
    const subjectName =
      subjectId === "all"
        ? allFem
        : ((subjects.data ?? []).find((s) => s.id === subjectId)?.name ?? "—");
    const topicName =
      topicId === "all"
        ? all
        : topicMap.get(topicId)
          ? topicDisplayName(topicMap.get(topicId)!)
          : "—";
    const subtopicName =
      subtopicId === "all"
        ? all
        : topicMap.get(subtopicId)
          ? topicDisplayName(topicMap.get(subtopicId)!)
          : "—";
    const notebookName =
      notebookId === "all"
        ? allFem
        : ((notebooksList.data ?? []).find((nb: any) => nb.id === notebookId)?.name ?? "—");
    return [
      { label: exportTr("Matéria"), value: subjectName },
      { label: exportTr("Assunto"), value: topicName },
      { label: exportTr("Subtópico"), value: subtopicName },
      { label: sc.fc.flashSession, value: notebookName },
      {
        label: exportTr("Favoritos"),
        value: onlyFavorites ? (extLang ? exportTr("Favoritos") : tr("somente favoritos")) : "",
      },
      {
        label: t.reports.reviewed,
        value:
          reviewedFilter === "all"
            ? ""
            : reviewedFilter === "yes"
              ? t.reports.reviewedOnly
              : t.reports.notReviewedOnly,
      },
      { label: t.flashcardsList.searchPh, value: search.trim() },
    ];
  }

  async function exportPdf() {
    const rows = exportRows();
    if (!rows.length) return;
    const head = Object.keys(rows[0]);
    await exportFlashcardsReportPdf({
      head: head.map((k, index) => (index === 0 ? "#" : k)),
      body: rows.map((r) => head.map((k) => String((r as any)[k] ?? ""))),
      filters: reportFilters(),
      fileName: `flashpilot-${todayLocal()}`,
      title: t.reports.title,
      locale: extLang || lang,
      labels: {
        generatedAt: extLang ? sc.fc.generatedAt : tr("Gerado em"),
        card: T("flashcard"),
        cards: T("flashcards"),
        page: extLang ? sc.fc.page : tr("Página"),
        of: extLang ? sc.fc.of : tr("de"),
        footer: "FlashPilot",
      },
      // Larguras fixas para nenhuma coluna quebrar palavra no meio.
      columnStyles: {
        0: { cellWidth: 11 },
        1: { cellWidth: 26 },
        2: { cellWidth: 32 },
        3: { cellWidth: 65 },
        4: { cellWidth: 65 },
        5: { cellWidth: 20 },
        6: { cellWidth: 14 },
        7: { cellWidth: 21 },
        8: { cellWidth: 16 },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t.flashcardsList.label}
          </p>
          <h1 className="text-4xl font-serif">{t.flashcardsList.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.flashcardsList.countInfo(filtered.length)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={onlyFavorites ? "default" : "outline"}
            onClick={() => {
              setOnlyFavorites((v) => !v);
              setPage(1);
            }}
          >
            <Star className={`h-4 w-4 mr-1 ${onlyFavorites ? "fill-current" : ""}`} />{" "}
            {T("Favoritos")}
          </Button>
          <Select
            value={reviewedFilter}
            onValueChange={(v) => {
              setReviewedFilter(v as "all" | "yes" | "no");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{sc.fc.reviewedAll}</SelectItem>
              <SelectItem value="yes">{sc.fc.reviewedYes}</SelectItem>
              <SelectItem value="no">{sc.fc.reviewedNo}</SelectItem>
            </SelectContent>
          </Select>
          <Link to="/study" search={{ favorites: true } as any}>
            <Button variant="secondary" disabled={(cards.data ?? []).every((r) => !r.is_favorite)}>
              {T("Revisar favoritos")}
            </Button>
          </Link>
          {subjectId !== "all" && (
            <Link to="/ebook/$subjectId" params={{ subjectId }}>
              <Button variant="outline"><BookOpen className="h-4 w-4 mr-1" /> E-book</Button>
            </Link>
          )}
          {/* Excel e CSV são exclusivos do AppManager; o aluno exporta apenas em PDF. */}
          {plan.isAppManager && (
            <>
              <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> {t.flashcardsList.exportExcel}
              </Button>
              <Button
                variant="outline"
                onClick={exportCsv}
                disabled={filtered.length === 0}
                title={T("CSV de duas colunas (Face A / Face B)")}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
              </Button>
            </>
          )}

          <Button variant="outline" onClick={exportPdf} disabled={filtered.length === 0}>
            <FileText className="h-4 w-4 mr-1" /> {t.flashcardsList.exportPdf}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setPrazoScanOpen(true)}
            title={T("Copiar cards sobre prazos para o assunto Estudo dos Prazos")}
          >
            <Timer className="h-4 w-4 mr-1" /> {T("Varredura de prazos")}
          </Button>
        </div>
      </div>

      <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{sc.fc.flashSession}</label>
          <Select
            value={notebookId}
            onValueChange={(v) => {
              setNotebookId(v);
              setSubjectId("all");
              setTopicId("all");
              setSubtopicId("all");
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={sc.fc.allFem} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{sc.fc.allFem}</SelectItem>
              {(notebooksList.data ?? []).map((nb: any) => (
                <SelectItem key={nb.id} value={nb.id}>
                  {nb.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{t.flashcardsList.subject}</label>
          <Select
            value={subjectId}
            onValueChange={(v) => {
              setSubjectId(v);
              setTopicId("all");
              setSubtopicId("all");
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.subject.all}</SelectItem>
              {(subjects.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{t.flashcardsList.topic}</label>
          <Select
            value={topicId}
            onValueChange={(v) => {
              if (v === "__new__") {
                if (subjectId === "all") {
                  toast.error(sc.fc.pickSubjectFirst);
                  return;
                }
                setNewTopicName("");
                setNewTopicOpen(true);
                return;
              }
              setTopicId(v);
              setSubtopicId("all");
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[50vh]">
              <SelectItem value="all">{t.flashcardsList.allTopics}</SelectItem>
              {parentTopics.map((tp) => (
                <SelectItem key={tp.id} value={tp.id} title={tp.path}>
                  {indentTopicLabel(tp)}
                </SelectItem>
              ))}
              <SelectItem value="__new__" className="text-primary font-medium">
                + {T("Criar novo assunto")}
              </SelectItem>
            </SelectContent>
          </Select>

          <label
            className={`flex items-center gap-2 text-xs pt-1 ${topicId === "all" || subtopicId !== "all" ? "opacity-50" : "cursor-pointer"}`}
          >
            <Checkbox
              checked={onlyDirectTopic}
              onCheckedChange={(v) => {
                setOnlyDirectTopic(!!v);
                setPage(1);
              }}
              disabled={topicId === "all" || subtopicId !== "all"}
            />
            <span>{sc.fc.onlyThisItem}</span>
          </label>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{sc.fc.subtopic}</label>
          <Select
            value={subtopicId}
            onValueChange={(v) => {
              setSubtopicId(v);
              setPage(1);
            }}
            disabled={topicId === "all" || subtopics.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  topicId === "all"
                    ? sc.fc.pickTopic
                    : subtopics.length === 0
                      ? sc.fc.noLevels
                      : sc.fc.all
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-[50vh]">
              <SelectItem value="all">{sc.fc.all}</SelectItem>
              {subtopics.map((tp) => (
                <SelectItem key={tp.id} value={tp.id} title={tp.path}>
                  {indentTopicLabel(tp)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{t.flashcardsList.searchLabel}</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 pr-12"
              placeholder={t.flashcardsList.searchPh}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <MicButton
              value={search}
              onChange={(v: string) => {
                setSearch(v);
                setPage(1);
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{t.flashcardsList.rowsPerPage}</label>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === ALL_SENTINEL ? T("Todos") : n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 backdrop-blur p-3 shadow-card">
          <div className="text-sm">
            <span className="font-medium">{selected.size}</span>{" "}
            {selected.size === 1 ? "selecionado" : "selecionados"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ids = filtered.map((r) => r.id);
                const allOn = ids.every((id) => selected.has(id));
                setSelected(allOn ? new Set() : new Set(ids));
              }}
            >
              {filtered.every((r) => selected.has(r.id)) ? sc.fc.unselectAll : sc.fc.selectAll}
            </Button>
            <Button variant="outline" size="sm" onClick={clearSel}>
              {sc.fc.clear}
            </Button>
            <Button size="sm" onClick={() => openMove(Array.from(selected))}>
              <FolderInput className="h-4 w-4 mr-1" /> {sc.fc.moveBtn}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setNotebookIds(Array.from(selected))}
            >
              <BookMarked className="h-4 w-4 mr-1" /> {T("Adicionar a Flash Session")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulkAttach("note")}>
              <Link2 className="h-4 w-4 mr-1" /> {T("Vincular anotação")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulkAttach("image")}>
              <ImageIcon className="h-4 w-4 mr-1" /> {T("Vincular imagem")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulkAttach("video")}>
              <Video className="h-4 w-4 mr-1" /> {T("Vincular vídeo")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (selected.size > 60) {
                  toast.error(sc.fc.mapLimit);
                  return;
                }
                setMindMapOpen(true);
              }}
            >
              <Network className="h-4 w-4 mr-1" /> {sc.fc.genMindMap}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setBulkLang(null);
                setLangOpen(true);
              }}
            >
              <Languages className="h-4 w-4 mr-1" /> {t.subject.setLanguage}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={removeBulk.isPending}
              onClick={() => setConfirmDelBulk(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> {T("Excluir")}
            </Button>
          </div>
        </div>
      )}

      {cards.isLoading ? (
        <div className="text-sm text-muted-foreground">{t.common.loading}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-card/40">
          <List className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="mt-4 font-serif text-xl">{t.flashcardsList.emptyTitle}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t.flashcardsList.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([sId, s]) => (
            <div key={sId} className="space-y-2">
              <h2 className="text-lg font-serif text-muted-foreground">{s.subjectName}</h2>
              {Array.from(s.topics.entries()).map(([tId, tp]) => (
                <div key={tId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Link
                      to="/topics/$topicId"
                      params={{ topicId: tId }}
                      search={{ edit: undefined }}
                      className="text-sm font-medium hover:underline"
                    >
                      {tp.topicName}
                    </Link>
                    <span className="text-xs text-muted-foreground">{tp.rows.length}</span>
                  </div>
                  <SortableList
                    className="space-y-2"
                    ids={tp.rows.map((r) => r.id)}
                    disabled={!draggableTopics.has(tId)}
                    onReorder={(ids) => reorder.mutate(ids)}
                  >
                    {tp.rows.map((r) => (
                      <SortableItem key={r.id} id={r.id} disabled={!draggableTopics.has(tId)}>
                        {(handle) => (
                          <Card className="p-3 flex flex-wrap items-start gap-2">
                            {handle}
                            <Checkbox
                              className="mt-1 shrink-0"
                              checked={selected.has(r.id)}
                              onCheckedChange={() => toggleSel(r.id)}
                              aria-label={T("Selecionar")}
                            />
                            <div className="flex-1 basis-[70%] min-w-0">
                              <p className="text-sm font-medium break-words">
                                {r.order_index != null && (
                                  <span className="text-muted-foreground mr-1">
                                    #{r.order_index}
                                  </span>
                                )}
                                {r.question}
                              </p>
                              <p
                                className={`text-sm mt-0.5 break-words ${r.answer ? "text-muted-foreground" : "text-accent italic"}`}
                              >
                                {r.answer || t.flashcardsList.noAnswer}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 ml-auto shrink-0 flex-wrap justify-end">
                              <label
                                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                                title={T("Marcar como revisado")}
                              >
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 cursor-pointer"
                                  checked={!!r.reviewed}
                                  onChange={() =>
                                    toggleReviewed.mutate({ id: r.id, next: !r.reviewed })
                                  }
                                />
                                {T("Revisado")}
                              </label>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleFav.mutate({ id: r.id, next: !r.is_favorite })}
                                aria-label={sc.fc.favorite}
                                title={sc.fc.favorite}
                              >
                                <Star
                                  className={`h-4 w-4 ${r.is_favorite ? "fill-warning text-warning" : ""}`}
                                />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openMove([r.id])}
                                aria-label={sc.fc.moveBtn}
                                title={sc.fc.moveTo}
                              >
                                <FolderInput className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(r)}
                                aria-label={t.flashLink.editCard}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {r.source_id && !plan.isAppManager ? (
                                <span
                                  className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground"
                                  title={purchasedTexts.cannotDeleteItem}
                                  aria-label={purchasedTexts.cannotDeleteItem}
                                >
                                  <Lock className="h-4 w-4" />
                                </span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (confirm(t.topic.confirmRemoveCard)) remove.mutate(r.id);
                                  }}
                                  aria-label={t.common.remove}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </Card>
                        )}
                      </SortableItem>
                    ))}
                  </SortableList>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {t.flashcardsList.pageOf(currentPage, totalPages)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              {t.flashcardsList.prev}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              {t.flashcardsList.next}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={!!editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <div className="space-y-1">
                <div>{t.flashLink.editCard}</div>
                {editing && breadcrumbFor(editing) && (
                  <div className="text-xs text-muted-foreground font-normal truncate max-w-full">
                    {breadcrumbFor(editing)}
                  </div>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {sc.fc.flashSession}
              </span>
              {(cardNotebooks.data ?? []).length === 0 ? (
                <span className="text-xs text-muted-foreground">{sc.fc.none}</span>
              ) : (
                (cardNotebooks.data ?? []).map((nb: any) => (
                  <span
                    key={nb.id}
                    className="text-xs rounded-full border border-border px-2 py-0.5"
                  >
                    {nb.name}
                  </span>
                ))
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => editing && setNotebookIds([editing.id])}
              >
                <BookMarked className="h-4 w-4 mr-1" /> {sc.fc.addBtn}
              </Button>
            </div>
            <VoiceInput
              label={t.topic.question}
              value={eQ}
              onChange={setEQ}
              placeholder={t.topic.questionPh}
            />
            <VoiceInput
              label={t.topic.answer}
              value={eA}
              onChange={setEA}
              placeholder={t.topic.answerPh}
            />
            <div>
              <label className="text-sm font-medium block mb-1">{sc.fc.orderOptional}</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={T("ex.: 12 (nº do artigo)")}
                value={eOrder}
                onChange={(e) => setEOrder(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {T("Define a posição de exibição/revisão. Deixe vazio para usar a ordem padrão.")}
              </p>
            </div>
            <NoteLinkPicker value={eLinked} onChange={setELinked} />
            <MindMapPicker
              imagePath={eImagePath}
              categoryId={eImageCat}
              onChange={({ imagePath: p, categoryId: c }) => {
                setEImagePath(p);
                setEImageCat(c);
              }}
            />
            <VideoLinksPicker
              video1={eVideo1}
              video2={eVideo2}
              onChange={({ video1, video2 }) => {
                setEVideo1(video1);
                setEVideo2(video2);
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            {eA !== "" && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(t.topic.confirmClearAnswer)) setEA("");
                }}
              >
                {t.topic.clearAnswer}
              </Button>
            )}
            <Button onClick={() => update.mutate()} disabled={!eQ.trim() || update.isPending}>
              {update.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={moveOpen}
        onOpenChange={(v) => {
          if (!v && !move.isPending) {
            setMoveOpen(false);
            setMoveIds([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {moveIds.length > 1 ? sc.fc.moveMany(moveIds.length) : sc.fc.moveOne}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              {moveIds.length} {sc.fc.selectedCount(moveIds.length)}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{sc.fc.targetSubject}</label>
              <Select
                value={mSubject}
                onValueChange={(v) => {
                  setMSubject(v);
                  setMTopic("");
                }}
              >
                <SelectTrigger className="w-full [&>span]:truncate [&>span]:block [&>span]:text-left [&>span]:min-w-0">
                  <SelectValue placeholder={sc.fc.selectSubject} />
                </SelectTrigger>
                <SelectContent>
                  {(subjects.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                {sc.fc.targetTopic}{" "}
                <span className="text-xs text-muted-foreground">{sc.fc.targetTopicHint}</span>
              </label>
              <Select value={mTopic || "__geral__"} onValueChange={setMTopic} disabled={!mSubject}>
                <SelectTrigger className="w-full [&>span]:truncate [&>span]:block [&>span]:text-left [&>span]:min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__geral__">{sc.fc.generalCreate}</SelectItem>
                  {(moveTopics.data ?? []).map((tp) => (
                    <SelectItem key={tp.id} value={tp.id}>
                      <span style={{ paddingLeft: tp.depth * 14 }}>
                        {tp.depth > 0 ? "↳ " : ""}
                        {tp.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMoveOpen(false);
                setMoveIds([]);
              }}
              disabled={move.isPending}
            >
              {T("Cancelar")}
            </Button>
            <Button onClick={() => move.mutate()} disabled={!mSubject || move.isPending}>
              {move.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {T("Movendo…")}
                </>
              ) : (
                T("Mover")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddToNotebookDialog
        open={notebookIds.length > 0}
        onOpenChange={(v) => {
          if (!v) setNotebookIds([]);
        }}
        flashcardIds={notebookIds}
        onDone={() => {
          setNotebookIds([]);
          cardNotebooks.refetch();
        }}
      />

      <AlertDialog
        open={confirmDelBulk}
        onOpenChange={(v) => {
          if (!removeBulk.isPending) setConfirmDelBulk(v);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {T("Excluir {n} flashcard(s)?", { n: selected.size })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {T(
                "Esta ação não pode ser desfeita. Os flashcards selecionados serão removidos permanentemente.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeBulk.isPending}>{T("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeBulk.isPending}
              onClick={(e) => {
                e.preventDefault();
                removeBulk.mutate(Array.from(selected));
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeBulk.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {T("Excluindo…")}
                </>
              ) : (
                T("Excluir")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={langOpen}
        onOpenChange={(v) => {
          if (!setLangBulk.isPending) setLangOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t.subject.setLanguage} — {selected.size} {selected.size === 1 ? "card" : "cards"}
            </DialogTitle>
          </DialogHeader>
          <LanguageSelect
            value={bulkLang}
            onChange={setBulkLang}
            label={t.subject.language}
            noneLabel={t.subject.cardLanguageInherit}
            disabled={setLangBulk.isPending}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLangOpen(false)}
              disabled={setLangBulk.isPending}
            >
              {t.common.cancel}
            </Button>
            <Button
              disabled={setLangBulk.isPending || selected.size === 0}
              onClick={() => setLangBulk.mutate(Array.from(selected))}
            >
              {setLangBulk.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.common.saving}
                </>
              ) : (
                t.common.save
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkAttachDialog
        open={bulkAttach !== null}
        onOpenChange={(o) => {
          if (!o) setBulkAttach(null);
        }}
        mode={bulkAttach ?? "note"}
        ids={Array.from(selected)}
        onDone={clearSel}
      />
      <Dialog
        open={newTopicOpen}
        onOpenChange={(v) => {
          if (!createTopic.isPending) setNewTopicOpen(v);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{T("Novo assunto")}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={T("Nome do assunto")}
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTopicName.trim()) createTopic.mutate();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewTopicOpen(false)}
              disabled={createTopic.isPending}
            >
              {T("Cancelar")}
            </Button>
            <Button
              onClick={() => createTopic.mutate()}
              disabled={!newTopicName.trim() || createTopic.isPending}
            >
              {createTopic.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {T("Criando…")}
                </>
              ) : (
                T("Criar")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GenerateMindMapDialog
        open={mindMapOpen}
        onOpenChange={setMindMapOpen}
        source={{ kind: "cards", cardIds: Array.from(selected) }}
      />

      <PrazoScanDialog
        open={prazoScanOpen}
        onOpenChange={setPrazoScanOpen}
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["fc-list-all"] });
          qc.invalidateQueries({ queryKey: ["fc-list-topics"] });
          qc.invalidateQueries({ queryKey: ["fc-list-subjects"] });
          qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
        }}
      />
    </div>
  );
}
