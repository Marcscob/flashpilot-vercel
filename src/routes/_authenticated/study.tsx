import { useStudyT } from "@/lib/i18n-audit";
import { T } from "@/lib/i18n-ui";
import { pageHead } from "@/lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { reviewFlashcard } from "@/lib/flashcards.functions";
import { FlipCard } from "@/components/FlipCard";
import { MicrocontextRecap } from "@/components/MicrocontextRecap";
import { effectiveLanguageOrUndefined } from "@/lib/card-language";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Star,
  Loader2,
  X,
  HelpCircle,
  CheckCheck,
  Shuffle,
  BookMarked,
} from "lucide-react";
import { AddToNotebookDialog } from "@/components/AddToNotebookDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { computeSm2 } from "@/lib/sm2";
import { toast } from "sonner";
import { z } from "zod";
import { useT } from "@/lib/i18n";
import { todayLocal } from "@/lib/today";
import { topicDisplayName } from "@/lib/topic-tree";
import { getNotebook, saveNotebookProgress } from "@/lib/notebooks.functions";
import { prefetchSpeech } from "@/lib/tts";
import { speechPrefetchWindow } from "@/lib/speech-prefetch-window";
import { sortBySourceOrder } from "@/lib/study-source-order";

const searchSchema = z.object({
  topic: z.string().optional(),
  subject: z.string().optional(),
  all: z.coerce.boolean().optional(),
  favorites: z.coerce.boolean().optional(),
  notebook: z.string().optional(),
});

const STUDY_CARD_SELECT =
  "id, user_id, question, answer, language, card_format, order_index, created_at, user_answer, reviewed, is_favorite, topic_id, ease_factor, interval_days, repetitions, linked_note_id, image_url, image_category_id, image_pins, image_focus, video_url_1, video_url_2, microcontext:microcontexts(id, title, content, order_index, user_notes), linked_note:notes!flashcards_linked_note_id_fkey(id, title), topics!inner(name, article_range, parent_id, order_index, created_at, review_enabled, subject_id, subjects(name, color, language))";

// PostgREST não expõe a auto-relação topics->topics, então buscamos a cadeia
// completa de pais (assunto › subtópico › subitem…) e anexamos em cada card.
async function attachParentTopicNames(cards: any[]): Promise<any[]> {
  const names = new Map<string, { name: string; parent_id: string | null; order_index: number | null; created_at: string }>();
  let pending = Array.from(
    new Set(cards.map((c) => c?.topics?.parent_id).filter((id): id is string => !!id)),
  );
  for (let level = 0; level < 8 && pending.length > 0; level++) {
    const { data, error } = await supabase
      .from("topics")
      .select("id, name, article_range, parent_id, order_index, created_at")
      .in("id", pending);
    if (error) throw error;
    for (const t of data ?? [])
      names.set(t.id, { name: topicDisplayName(t), parent_id: t.parent_id, order_index: t.order_index, created_at: t.created_at });
    pending = Array.from(
      new Set(
        (data ?? []).map((t) => t.parent_id).filter((id): id is string => !!id && !names.has(id)),
      ),
    );
  }
  if (names.size === 0) return cards;
  return cards.map((c) => {
    const chain: string[] = [];
    const sourceAncestors = [];
    let pid: string | null | undefined = c?.topics?.parent_id;
    let guard = 0;
    while (pid && guard++ < 8) {
      const node = names.get(pid);
      if (!node) break;
      chain.unshift(node.name);
      sourceAncestors.unshift(node);
      pid = node.parent_id;
    }
    if (chain.length === 0) return c;
    return { ...c, topics: { ...c.topics, chain, sourceAncestors, parent: { name: chain[chain.length - 1] } } };
  });
}

type OrderMode = "source" | "shuffle";

function topicPathOf(card: any): { assunto: string; subtopico: string } {
  const topic = card?.topics;
  const chain = (topic?.chain as string[] | undefined) ?? [];
  if (chain.length === 0) return { assunto: topic ? topicDisplayName(topic) : "", subtopico: "" };
  return {
    assunto: chain[0] ?? "",
    subtopico: [...chain.slice(1), topic ? topicDisplayName(topic) : ""]
      .filter(Boolean)
      .join(" › "),
  };
}

function topicLabelOf(card: any): string {
  const { assunto, subtopico } = topicPathOf(card);
  return subtopico ? `${assunto} › ${subtopico}` : assunto;
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

// Embaralhamento determinístico por id do card: a ordem depende apenas da seed
// e dos ids, então continua idêntica mesmo quando a fila é recarregada do
// servidor no meio da sessão (após avaliar um card, por exemplo).
function hashCardId(id: string, seed: number): number {
  let h = seed >>> 0 || 1;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function shuffleWithSeed(cards: any[], seed: number): any[] {
  return [...cards].sort((a, b) => {
    const ha = hashCardId(String(a.id), seed);
    const hb = hashCardId(String(b.id), seed);
    return ha - hb || collator.compare(String(a.id), String(b.id));
  });
}

type StudyProgress = { cardId?: string; done?: number; savedAt?: number };

function readSavedStudyProgress(storageKey: string): StudyProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw =
      window.localStorage.getItem(storageKey) ?? window.sessionStorage.getItem(storageKey);
    if (!raw) return {};
    return JSON.parse(raw) as StudyProgress;
  } catch {
    return {};
  }
}

function writeSavedStudyProgress(storageKey: string, value: { cardId: string; done: number }) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify({ ...value, savedAt: Date.now() });
    window.localStorage.setItem(storageKey, raw);
    window.sessionStorage.setItem(storageKey, raw);
  } catch {}
}

function clearSavedStudyProgress(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
  } catch {}
}

async function fetchSavedStudyCard(cardId: string) {
  // Fetch by id only — the user was actively viewing this card, so we always
  // want to bring it back regardless of current filters/due-date state.
  const { data, error } = await supabase
    .from("flashcards")
    .select(STUDY_CARD_SELECT)
    .eq("id", cardId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const Route = createFileRoute("/_authenticated/study")({
  head: () =>
    pageHead(
      "Revisão de flashcards — FlashPilot",
      "Revise seus flashcards e acompanhe sua aprendizagem no FlashPilot.",
    ),
  validateSearch: (s) => searchSchema.parse(s),
  component: StudyPage,
});

function StudyPage() {
  const s0 = useStudyT();
  const search = Route.useSearch();
  const qc = useQueryClient();
  const review = useServerFn(reviewFlashcard);
  const t = useT();

  const notebookId = search.notebook ?? null;
  const getNotebookFn = useServerFn(getNotebook);
  const saveNotebookProgressFn = useServerFn(saveNotebookProgress);

  const notebook = useQuery({
    queryKey: ["notebook-ctx", notebookId],
    enabled: !!notebookId,
    queryFn: () => getNotebookFn({ data: { id: notebookId as string } }),
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const notebookMode = (notebook.data?.notebook.mode ?? "all") as string;
  const modeKey = notebookId
    ? `notebook:${notebookId}:${notebookMode}`
    : search.favorites
      ? "favorites"
      : search.all
        ? "all-cards"
        : "due";
  const storageKey = notebookId
    ? `study-progress:notebook:${notebookId}`
    : `study-progress:${search.topic ?? "all"}:${search.subject ?? "all"}:${modeKey}`;
  const cards = useQuery({
    queryKey: ["study-queue", search.topic ?? "all", search.subject ?? "all", modeKey],
    enabled: !notebookId || notebook.isSuccess,
    queryFn: async () => {
      const today = todayLocal();
      const { data: authData } = await supabase.auth.getUser();
      const myId = authData.user?.id ?? "";
      const savedCardId =
        readSavedStudyProgress(storageKey).cardId ??
        notebook.data?.notebook.current_card_id ??
        undefined;
      let topicScopeIds: string[] | undefined;
      let manualCardIds: string[] = [];
      if (notebookId) {
        topicScopeIds = notebook.data?.resolved.topicIds ?? [];
        manualCardIds = notebook.data?.resolved.cardIds ?? [];
      } else if (search.topic) {
        // Inclui todos os níveis abaixo (subtópicos, subitens, etc.)
        const scope = new Set<string>([search.topic]);
        let frontier = [search.topic];
        for (let level = 0; level < 8 && frontier.length > 0; level++) {
          const { data: childTopics, error: childTopicsError } = await supabase
            .from("topics")
            .select("id")
            .in("parent_id", frontier);
          if (childTopicsError) throw childTopicsError;
          frontier = (childTopics ?? []).map((tp) => tp.id).filter((id) => !scope.has(id));
          for (const id of frontier) scope.add(id);
        }
        topicScopeIds = Array.from(scope);
      }

      const applyMode = (query: any) => {
        if (notebookId) {
          if (notebookMode === "favorites") return query.eq("is_favorite", true);
          if (notebookMode === "due")
            return query
              .eq("topics.review_enabled", true)
              .or(`and(user_id.eq.${myId},due_date.lte.${today}),user_id.neq.${myId}`);
          return query;
        }
        if (search.favorites) return query.eq("is_favorite", true);
        if (!search.all)
          return query
            .eq("topics.review_enabled", true)
            .or(`and(user_id.eq.${myId},due_date.lte.${today}),user_id.neq.${myId}`);
        return query;
      };
      const baseQuery = () =>
        applyMode(
          supabase
            .from("flashcards")
            .select(STUDY_CARD_SELECT)
            .order("created_at", { ascending: true })
            .order("order_index", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true }),
        );
      const buildQuery = () => {
        let query = baseQuery();
        if (topicScopeIds) query = query.in("topic_id", topicScopeIds);
        if (search.subject) query = query.eq("topics.subject_id", search.subject);
        return query;
      };

      // PostgREST caps responses at 1000 rows — page through everything.
      const PAGE = 1000;
      const all: any[] = [];
      if (!topicScopeIds || topicScopeIds.length > 0) {
        for (let page = 0; ; page++) {
          const { data, error } = await buildQuery().range(page * PAGE, page * PAGE + PAGE - 1);
          if (error) throw error;
          const rows = data ?? [];
          all.push(...rows);
          if (rows.length < PAGE) break;
        }
      }

      if (manualCardIds.length > 0) {
        const seen = new Set(all.map((c: any) => c.id));
        const missing = manualCardIds.filter((id) => !seen.has(id));
        const CHUNK = 200;
        for (let i = 0; i < missing.length; i += CHUNK) {
          const { data, error } = await applyMode(
            supabase.from("flashcards").select(STUDY_CARD_SELECT),
          ).in("id", missing.slice(i, i + CHUNK));
          if (error) throw error;
          all.push(...(data ?? []));
        }
      }
      // Cards oficiais (de outra conta, liberados por compra): o progresso do
      // aluno vem de official_card_progress, não das colunas do autor.
      const officialIds = all
        .filter((c: any) => c.user_id && c.user_id !== myId)
        .map((c: any) => c.id);
      if (officialIds.length) {
        const progressById = new Map<string, any>();
        const CHUNK = 500;
        for (let i = 0; i < officialIds.length; i += CHUNK) {
          const { data: rows } = await supabase
            .from("official_card_progress")
            .select(
              "flashcard_id, ease_factor, interval_days, repetitions, due_date, last_reviewed_at",
            )
            .eq("user_id", myId)
            .in("flashcard_id", officialIds.slice(i, i + CHUNK));
          for (const r of rows ?? []) progressById.set(r.flashcard_id, r);
        }
        for (const card of all as any[]) {
          if (!card.user_id || card.user_id === myId) continue;
          const pr = progressById.get(card.id);
          card.official = true;
          card.ease_factor = pr?.ease_factor ?? 2.5;
          card.interval_days = pr?.interval_days ?? 0;
          card.repetitions = pr?.repetitions ?? 0;
          card.due_date = pr?.due_date ?? today;
          card.last_reviewed_at = pr?.last_reviewed_at ?? null;
        }
      }

      const dueOnly = notebookId ? notebookMode === "due" : !search.all && !search.favorites;
      const queue = dueOnly
        ? all.filter((c: any) => !c.official || String(c.due_date) <= today)
        : all;

      if (!savedCardId || queue.some((card) => card.id === savedCardId)) {
        return await attachParentTopicNames(queue as any[]);
      }

      const savedCard = await fetchSavedStudyCard(savedCardId);

      return await attachParentTopicNames((savedCard ? [savedCard, ...queue] : queue) as any[]);
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const [idx, setIdx] = useState(0);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [flipKey, setFlipKey] = useState(0);
  const orderStorageKey = `study-order:${storageKey}`;
  const [orderMode, setOrderMode] = useState<OrderMode>("source");
  const [shuffleSeed, setShuffleSeed] = useState(1);
  const [jumpValue, setJumpValue] = useState("");
  const [addToNotebookOpen, setAddToNotebookOpen] = useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(orderStorageKey);
      const saved = raw ? (JSON.parse(raw) as { mode?: OrderMode; seed?: number }) : null;
      setOrderMode(saved?.mode === "shuffle" ? "shuffle" : "source");
      setShuffleSeed(typeof saved?.seed === "number" ? saved.seed : 1);
    } catch {
      setOrderMode("source");
      setShuffleSeed(1);
    }
  }, [orderStorageKey]);

  function persistOrder(mode: OrderMode, seed: number) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(orderStorageKey, JSON.stringify({ mode, seed }));
    } catch {}
  }

  const rawQueue = cards.data ?? [];
  const queue = useMemo(
    () =>
      orderMode === "shuffle"
        ? shuffleWithSeed(rawQueue as any[], shuffleSeed)
        : sortBySourceOrder(rawQueue as any[]),
    [rawQueue, orderMode, shuffleSeed],
  );
  const microSeq = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of queue as any[]) { const id = c?.microcontext?.id; if (id && !m.has(id)) m.set(id, m.size); }
    return m;
  }, [queue]);
  const total = queue.length;
  const [done, setDone] = useState(0);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() => new Set<string>());
  const [progressRestored, setProgressRestored] = useState(false);
  const activeIdx = activeCardId ? queue.findIndex((card: any) => card.id === activeCardId) : -1;
  const visibleIdx = activeIdx >= 0 ? activeIdx : Math.min(idx, Math.max(total - 1, 0));
  const current = queue[visibleIdx];
  const currentRef = React.useRef<any>(null);
  const queueRef = React.useRef<any[]>([]);
  const doneRef = React.useRef(0);
  const gradingRef = React.useRef(false);
  const restoredStorageKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!progressRestored || !current) return;
    let active = true;
    const isCurrent = () => active;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          for (const card of speechPrefetchWindow(queue, visibleIdx)) {
            const lang = effectiveLanguageOrUndefined(card, card?.topics?.subjects);
            for (const text of [card.question, card.answer]) {
              if (!active) return;
              await prefetchSpeech(text, lang, isCurrent);
            }
          }
        } catch {
          active = false; // Stop this window on a denial/quota error; never retry in background.
        }
      })();
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [queue, visibleIdx, progressRestored, current]);

  // Restore last-seen card when the page remounts (e.g. mobile tab reload)
  React.useEffect(() => {
    if (restoredStorageKeyRef.current !== storageKey) {
      restoredStorageKeyRef.current = null;
      setProgressRestored(false);
      setIdx(0);
      setActiveCardId(null);
      setDone(0);
      setReviewedIds(new Set<string>());
    }
  }, [storageKey]);

  React.useEffect(() => {
    if (restoredStorageKeyRef.current === storageKey || queue.length === 0) return;
    restoredStorageKeyRef.current = storageKey;
    try {
      const local = readSavedStudyProgress(storageKey);
      // Flash Session: a sessão vive no banco, então ela vale em qualquer aparelho.
      const dbCardId = notebookId
        ? (notebook.data?.notebook.current_card_id ?? undefined)
        : undefined;
      const dbReviewed = notebookId ? (notebook.data?.notebook.reviewed_card_ids ?? []) : [];
      const saved: StudyProgress = local.cardId
        ? local
        : { cardId: dbCardId, done: dbReviewed.length };
      if (notebookId && dbReviewed.length > 0) setReviewedIds(new Set(dbReviewed));
      if (saved.cardId) {
        const found = queue.findIndex((c: any) => c.id === saved.cardId);
        if (found >= 0) {
          setIdx(found);
          setActiveCardId(saved.cardId);
        }
      } else if ((queue[0] as any)?.id) {
        setActiveCardId((queue[0] as any).id);
      }
      if (typeof saved.done === "number") setDone(Math.max(0, Math.min(saved.done, queue.length)));
    } finally {
      setProgressRestored(true);
    }
  }, [queue, storageKey, notebookId, notebook.data]);

  // Sincroniza a posição/progresso da Flash Session no banco (debounce), para
  // continuar de onde parou em qualquer dispositivo.
  React.useEffect(() => {
    if (!notebookId || !progressRestored) return;
    const cardId = (current as any)?.id ?? null;
    const handle = setTimeout(() => {
      saveNotebookProgressFn({
        data: {
          id: notebookId,
          currentCardId: cardId,
          reviewedCardIds: Array.from(reviewedIds),
          orderMode,
          shuffleSeed,
        },
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(handle);
  }, [
    notebookId,
    progressRestored,
    current,
    reviewedIds,
    orderMode,
    shuffleSeed,
    saveNotebookProgressFn,
  ]);

  React.useEffect(() => {
    currentRef.current = current ?? null;
    queueRef.current = queue as any[];
    doneRef.current = done;
  }, [current, done, queue]);

  const persistVisibleCard = React.useCallback(() => {
    const visibleCard = currentRef.current;
    if (!progressRestored || !visibleCard?.id) return;
    writeSavedStudyProgress(storageKey, { cardId: visibleCard.id, done: doneRef.current });
  }, [progressRestored, storageKey]);

  const restoreVisibleCard = React.useCallback(() => {
    if (!progressRestored || gradingRef.current) return;
    const saved = readSavedStudyProgress(storageKey);
    if (!saved.cardId || currentRef.current?.id === saved.cardId) return;
    const found = queueRef.current.findIndex((c: any) => c.id === saved.cardId);
    if (found >= 0) {
      setIdx(found);
      setActiveCardId(saved.cardId);
      setFlipKey((k) => k + 1);
      if (typeof saved.done === "number")
        setDone(Math.max(0, Math.min(saved.done, queueRef.current.length)));
    }
  }, [progressRestored, storageKey]);

  // Persist current card id + done counter so a remount can resume
  React.useEffect(() => {
    if (!progressRestored || !current) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden" &&
      !gradingRef.current
    )
      return;
    writeSavedStudyProgress(storageKey, { cardId: (current as any).id, done });
  }, [current, done, progressRestored, storageKey]);

  // Browser/mobile tab freezing can remount or refetch UI while hidden. Keep the
  // last visible card locked in storage and restore it immediately on return.
  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const saveBeforeLeaving = () => {
      if (!gradingRef.current) persistVisibleCard();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") saveBeforeLeaving();
      if (document.visibilityState === "visible") restoreVisibleCard();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", saveBeforeLeaving);
    window.addEventListener("blur", saveBeforeLeaving);
    window.addEventListener("focus", restoreVisibleCard);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", saveBeforeLeaving);
      window.removeEventListener("blur", saveBeforeLeaving);
      window.removeEventListener("focus", restoreVisibleCard);
    };
  }, [persistVisibleCard, restoreVisibleCard]);

  // Keyboard navigation: left/right arrows move between cards without grading.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      e.preventDefault();
      if (e.key === "ArrowLeft") goPrev();
      else goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [total, visibleIdx]);

  // Progresso = cards efetivamente revisados nesta sessão / total da sessão.
  // Independe da ordem (embaralhar não pode alterar o percentual).
  const sessionTotal = useMemo(() => {
    const inQueue = new Set(queue.map((c: any) => c.id));
    let extra = 0;
    reviewedIds.forEach((id) => {
      if (!inQueue.has(id)) extra += 1;
    });
    return total + extra;
  }, [queue, total, reviewedIds]);

  const progressPct = useMemo(
    () => (sessionTotal ? Math.round((reviewedIds.size / sessionTotal) * 100) : 0),
    [reviewedIds, sessionTotal],
  );

  const QUALITY = [
    { q: 0, key: "forgot" as const, tone: "destructive", Icon: X },
    { q: 3, key: "hard" as const, tone: "warning", Icon: HelpCircle },
    { q: 4, key: "good" as const, tone: "primary", Icon: Check },
    { q: 5, key: "easy" as const, tone: "success", Icon: CheckCheck },
  ];

  const predictions = useMemo(() => {
    const state = {
      ease_factor: (current as any)?.ease_factor ?? 2.5,
      interval_days: (current as any)?.interval_days ?? 0,
      repetitions: (current as any)?.repetitions ?? 0,
    };
    const map: Record<number, number> = {};
    for (const { q } of [{ q: 0 }, { q: 3 }, { q: 4 }, { q: 5 }]) {
      map[q] = computeSm2(state, q).interval_days;
    }
    return map;
  }, [current]);

  function formatInterval(days: number) {
    if (days <= 0) return "hoje";
    if (days === 1) return "1d";
    return `${days}d`;
  }

  const [grading, setGrading] = useState(false);

  async function grade(quality: number) {
    if (!current || grading) return;
    setGrading(true);
    gradingRef.current = true;
    try {
      await review({ data: { flashcard_id: current.id, quality } });
      const gradedId = (current as any).id as string;
      setReviewedIds((prev) => {
        if (prev.has(gradedId)) return prev;
        const next = new Set(prev);
        next.add(gradedId);
        return next;
      });
      const nextDone = done + 1;
      setDone(nextDone);
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["subject-cards"] });
      qc.invalidateQueries({ queryKey: ["topic-review-scope"] });
      qc.invalidateQueries({ queryKey: ["subtopics"] });
      qc.invalidateQueries({ queryKey: ["home-search"] });
      if (visibleIdx + 1 < total) {
        const nextCard = queue[visibleIdx + 1] as any;
        if (nextCard?.id)
          writeSavedStudyProgress(storageKey, { cardId: nextCard.id, done: nextDone });
        setActiveCardId(nextCard?.id ?? null);
        setIdx(visibleIdx + 1);
        setFlipKey((k) => k + 1);
      } else {
        toast.success(t.study.completed);
        qc.invalidateQueries({ queryKey: ["cards"] });
        clearSavedStudyProgress(storageKey);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.study.errorRecord);
    } finally {
      gradingRef.current = false;
      setGrading(false);
    }
  }

  function goPrev() {
    if (visibleIdx <= 0 || grading) return;
    const prevIdx = visibleIdx - 1;
    const prevCard = queue[prevIdx] as any;
    if (prevCard?.id) writeSavedStudyProgress(storageKey, { cardId: prevCard.id, done });
    setActiveCardId(prevCard?.id ?? null);
    setIdx(prevIdx);
    setFlipKey((k) => k + 1);
  }

  function goNext() {
    if (visibleIdx + 1 >= total || grading) return;
    const nextIdx = visibleIdx + 1;
    const nextCard = queue[nextIdx] as any;
    if (nextCard?.id) writeSavedStudyProgress(storageKey, { cardId: nextCard.id, done });
    setActiveCardId(nextCard?.id ?? null);
    setIdx(nextIdx);
    setFlipKey((k) => k + 1);
  }

  function goTo(n: number) {
    if (grading) return;
    const target = Math.min(Math.max(Math.trunc(n), 1), total) - 1;
    if (!Number.isFinite(target) || target < 0) return;
    const card = queue[target] as any;
    if (card?.id) writeSavedStudyProgress(storageKey, { cardId: card.id, done });
    setActiveCardId(card?.id ?? null);
    setIdx(target);
    setFlipKey((k) => k + 1);
  }

  const isOfficial = Boolean((current as any)?.official);

  if (cards.isLoading || (queue.length > 0 && !progressRestored))
    return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;

  if (total === 0) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="mx-auto h-16 w-16 rounded-full bg-success/15 flex items-center justify-center">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h1 className="text-3xl font-serif mt-6">{t.study.allDone}</h1>
        <p className="text-muted-foreground mt-2">
          {done > 0 ? t.study.reviewedCount(done) : t.study.nothingToday}
        </p>
        <Link to="/review" className="inline-block mt-6">
          <Button variant="secondary">{t.homeHub.review}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/review"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> {t.study.exit}
        </Link>
        <div className="flex items-center gap-3">
          {isOfficial && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              {T("Oficial")}
            </span>
          )}
          {!isOfficial && (
            <button
              type="button"
              onClick={async () => {
                const next = !(current as any).is_favorite;
                const { error } = await supabase
                  .from("flashcards")
                  .update({ is_favorite: next })
                  .eq("id", current.id);
                if (error) {
                  toast.error(error.message);
                  return;
                }
                qc.setQueryData(
                  ["study-queue", search.topic ?? "all", search.subject ?? "all", modeKey],
                  (old: any) => {
                    if (!old) return old;
                    return old.map((c: any) =>
                      c.id === current.id ? { ...c, is_favorite: next } : c,
                    );
                  },
                );
                qc.invalidateQueries({ queryKey: ["favorites-count"] });
                toast.success(next ? T("Adicionado aos favoritos") : T("Removido dos favoritos"));
              }}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              aria-label={T("Favoritar")}
              title={T("Favoritar")}
            >
              <Star
                className={`h-5 w-5 ${(current as any)?.is_favorite ? "fill-warning text-warning" : ""}`}
              />
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={orderMode === "shuffle"}
            type="button"
            onClick={() => {
              const seed = Math.floor(Math.random() * 4294967295) + 1;
              const nextMode = orderMode === "shuffle" ? "source" : "shuffle";
              setShuffleSeed(seed);
              setOrderMode(nextMode);
              persistOrder(nextMode, seed);
              setActiveCardId((current as any)?.id ?? null);
              if (nextMode === "shuffle") toast.success(T("Flashcards embaralhados"));
            }}
            className={`p-1.5 rounded-lg hover:bg-secondary ${orderMode === "shuffle" ? "text-accent-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"}`}
            aria-label={T("Embaralhar flashcards")}
            title={T("Embaralhar flashcards")}
          >
            <Shuffle className="h-5 w-5" />
          </Button>
          <button
            type="button"
            onClick={() => setAddToNotebookOpen(true)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
            aria-label={T("Adicionar a uma Flash Session")}
            title={T("Adicionar a uma Flash Session")}
          >
            <BookMarked className="h-5 w-5" />
          </button>
          <form
            className="flex items-center gap-1 text-sm text-muted-foreground"
            onSubmit={(e) => {
              e.preventDefault();
              const n = parseInt(jumpValue, 10);
              if (!Number.isNaN(n)) goTo(n);
              setJumpValue("");
              (document.activeElement as HTMLElement | null)?.blur();
            }}
          >
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={total}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder={String(visibleIdx + 1)}
              aria-label={s0.gotoLabel}
              title={s0.gotoTitle}
              className="w-14 rounded-md border border-border bg-background px-1 py-0.5 text-center text-sm text-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span>/ {total}</span>
          </form>
        </div>
      </div>

      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="text-center">
        {notebookId && notebook.data?.notebook.name && (
          <p className="text-xs font-medium text-accent-foreground">
            {T("Flash Session:")} {notebook.data.notebook.name}
          </p>
        )}
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {(current as any)?.topics?.subjects?.name}
        </p>
      </div>

      <div className="flex justify-center">
        <MicrocontextRecap total={microSeq.size} position={microSeq.get((current as any)?.microcontext?.id)} micro={(current as any)?.microcontext} lang={current ? effectiveLanguageOrUndefined(current as any, (current as any)?.topics?.subjects) : undefined} />
      </div>

      <AddToNotebookDialog
        open={addToNotebookOpen}
        onOpenChange={setAddToNotebookOpen}
        flashcardIds={current ? [(current as any).id] : []}
      />

      <div className="relative flex items-stretch justify-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={visibleIdx <= 0 || grading}
          className="hidden sm:flex shrink-0 items-center justify-center self-center h-12 w-12 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition"
          aria-label={T("Card anterior")}
          title={T("Card anterior")}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={goPrev}
          disabled={visibleIdx <= 0 || grading}
          className="sm:hidden absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-10 w-10 rounded-full bg-card/80 border border-border text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition"
          aria-label={T("Card anterior")}
          title={T("Card anterior")}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div className="flex-1 min-w-0">
          <FlipCard
            key={flipKey}
            cardId={current.id}
            isOfficial={isOfficial}
            question={current.question}
            answer={current.answer}
            userAnswer={(current as any).user_answer}
            linkedNote={(current as any).linked_note}
            mindMapPath={(current as any).image_url}
            videoUrls={[(current as any).video_url_1, (current as any).video_url_2]}
            cardFormat={(current as any).card_format}
            imagePilotPath={
              (current as any).card_format === "imagepilot" ? (current as any).image_url : null
            }
            imagePilotPins={(current as any).image_pins}
            imagePilotFocus={(current as any).image_focus}
            topicLabel={topicLabelOf(current)}
            lang={effectiveLanguageOrUndefined(current as any, (current as any)?.topics?.subjects)}
            reviewed={(current as any).reviewed}
            onToggleReviewed={
              isOfficial
                ? undefined
                : async (next) => {
                    const { error } = await supabase
                      .from("flashcards")
                      .update({
                        reviewed: next,
                        reviewed_marked_at: next ? new Date().toISOString() : null,
                      })
                      .eq("id", current.id);
                    if (error) {
                      toast.error(error.message);
                      throw error;
                    }
                    qc.setQueryData(
                      ["study-queue", search.topic ?? "all", search.subject ?? "all", modeKey],
                      (old: any) => {
                        if (!old) return old;
                        return old.map((c: any) =>
                          c.id === current.id ? { ...c, reviewed: next } : c,
                        );
                      },
                    );
                    qc.invalidateQueries({ queryKey: ["fc-list-all"] });
                    toast.success(next ? T("Marcado como revisado") : T("Desmarcado"));
                  }
            }

            onSave={
              isOfficial
                ? undefined
                : async ({ question, answer }) => {
                    const { error } = await supabase
                      .from("flashcards")
                      .update({ question, answer })
                      .eq("id", current.id);
                    if (error) {
                      toast.error(error.message);
                      throw error;
                    }
                    qc.setQueryData(
                      ["study-queue", search.topic ?? "all", search.subject ?? "all", modeKey],
                      (old: any) => {
                        if (!old) return old;
                        return old.map((c: any) =>
                          c.id === current.id ? { ...c, question, answer } : c,
                        );
                      },
                    );
                    qc.invalidateQueries({ queryKey: ["cards"] });
                    toast.success(t.common.save);
                  }
            }
            onSaveUserAnswer={
              isOfficial
                ? undefined
                : async (user_answer) => {
                    const { error } = await supabase
                      .from("flashcards")
                      .update({ user_answer })
                      .eq("id", current.id);
                    if (error) {
                      toast.error(error.message);
                      throw error;
                    }
                    qc.setQueryData(
                      ["study-queue", search.topic ?? "all", search.subject ?? "all", modeKey],
                      (old: any) => {
                        if (!old) return old;
                        return old.map((c: any) =>
                          c.id === current.id ? { ...c, user_answer } : c,
                        );
                      },
                    );
                    toast.success(T("Sua resposta foi salva"));
                  }
            }
          />
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={visibleIdx + 1 >= total || grading}
          className="hidden sm:flex shrink-0 items-center justify-center self-center h-12 w-12 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition"
          aria-label={s0.nextCard}
          title={s0.nextCard}
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={visibleIdx + 1 >= total || grading}
          className="sm:hidden absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-10 w-10 rounded-full bg-card/80 border border-border text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition"
          aria-label={s0.nextCard}
          title={s0.nextCard}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div>
        <p className="text-center text-sm text-muted-foreground mb-3">
          {grading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.common.loading}
            </span>
          ) : (
            t.study.howWas
          )}
        </p>
        <TooltipProvider delayDuration={200}>
          <div
            className={`grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto_1fr_1fr] items-stretch gap-2 ${grading ? "opacity-60 pointer-events-none" : ""}`}
          >
            {QUALITY.map(({ q, key, tone, Icon }, i) => {
              const meta = t.study.q[key];
              const days = predictions[q];
              return (
                <React.Fragment key={q}>
                  {i === 2 && (
                    <div className="hidden sm:block w-px bg-border/60 mx-1" aria-hidden />
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => grade(q)}
                        disabled={grading}
                        className={`rounded-xl p-3 text-sm font-medium transition border-2 border-transparent hover:border-foreground/20 disabled:cursor-not-allowed flex flex-col items-center gap-1 ${toneClass(tone)}`}
                      >
                        <Icon className="h-4 w-4" />
                        <div>{meta.label}</div>
                        <div className="text-[11px] opacity-90 font-semibold tabular-nums">
                          {formatInterval(days)}
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-center">
                      {meta.hint}
                    </TooltipContent>
                  </Tooltip>
                </React.Fragment>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}

function toneClass(tone: string) {
  switch (tone) {
    case "destructive":
      return "bg-destructive/15 text-destructive";
    case "warning":
      return "bg-warning/25 text-warning-foreground";
    case "success":
      return "bg-success/15 text-success";
    default:
      return "bg-primary/10 text-primary";
  }
}
