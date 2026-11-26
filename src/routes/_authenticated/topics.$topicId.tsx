import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { T } from "@/lib/i18n-ui";
import { pageHead } from "@/lib/page-head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Plus,
  ChevronLeft,
  Play,
  Trash2,
  Layers,
  BellOff,
  Bell,
  Link2,
  Pencil,
  Search,
  ArrowRightLeft,
  Lock,
} from "lucide-react";
import { MoveTopicDialog } from "@/components/MoveTopicDialog";
import { toast } from "sonner";
import { VoiceInput } from "@/components/VoiceInput";
import { MicButton } from "@/components/MicButton";
import { NoteLinkPicker } from "@/components/NoteLinkPicker";
import { MindMapPicker } from "@/components/MindMapPicker";
import { VideoLinksPicker } from "@/components/VideoLinksPicker";
import { format, isPast } from "date-fns";
import { useT, useLang } from "@/lib/i18n";
import { usePlanLimit, useUpgradeDialog, FREE_LIMIT } from "@/lib/plan-limit";
import { usePurchasedTexts } from "@/lib/i18n-purchased";
import { extractOrderFromText, renumber } from "@/lib/order-index";
import { persistCardOrder } from "@/lib/reorder-cards";
import { SortableList, SortableItem } from "@/components/SortableList";
import { persistTreeOrder } from "@/lib/reorder-tree";
import { todayLocal } from "@/lib/today";
import { depthOf, levelLabel, topicDisplayName, type FlatTopic } from "@/lib/topic-tree";
import { EditTopicDialog, type EditableTopic } from "@/components/EditTopicDialog";
import { LanguageSelect } from "@/components/LanguageSelect";
import { saveFlashcardsAtomically } from "@/lib/flashcards-save.functions";
import { TopicMatchGames } from "@/components/TopicMatchGames";

export const Route = createFileRoute("/_authenticated/topics/$topicId")({
  head: () =>
    pageHead(
      "Flashcards do assunto — FlashPilot",
      "Estude os flashcards e subtópicos deste assunto no FlashPilot.",
    ),
  component: TopicPage,
  validateSearch: (search: Record<string, unknown>) => ({
    edit: typeof search.edit === "string" ? search.edit : undefined,
  }),
});

type CardRow = {
  id: string;
  question: string;
  answer: string;
  due_date: string;
  repetitions: number;
  order_index: number | null;
  linked_note_id: string | null;
  image_url: string | null;
  video_url_1?: string | null;
  video_url_2?: string | null;
  image_category_id: string | null;
  language?: string | null;
  source_id?: string | null;
  user_modified?: boolean | null;
  linked_note: { id: string; title: string } | null;
};

function TopicPage() {
  const { topicId } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();
  const t = useT();
  const { locale, lang } = useLang();
  const purchasedTexts = usePurchasedTexts(lang);

  const topic = useQuery({
    queryKey: ["topic", topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select(
          "id, user_id, name, article_range, subject_id, parent_id, review_enabled, source_id, subjects(id, name, color, source_id)",
        )
        .eq("id", topicId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const parentTopic = useQuery({
    queryKey: ["parent-topic", topic.data?.parent_id],
    enabled: !!topic.data?.parent_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, article_range")
        .eq("id", topic.data!.parent_id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Todos os tópicos da matéria: usados para o caminho completo (breadcrumb)
  // e para saber a profundidade do item atual.
  const subjectTopics = useQuery({
    queryKey: ["subject-topics", topic.data?.subject_id],
    enabled: !!topic.data?.subject_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, article_range, parent_id, subject_id")
        .eq("subject_id", topic.data!.subject_id!)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as FlatTopic[];
    },
  });

  const topicMap = useMemo(
    () => new Map((subjectTopics.data ?? []).map((tp) => [tp.id, tp])),
    [subjectTopics.data],
  );
  const ancestors = useMemo(() => {
    const out: FlatTopic[] = [];
    let cur = topic.data?.parent_id ? topicMap.get(topic.data.parent_id) : undefined;
    let guard = 0;
    while (cur && guard++ < 10) {
      out.unshift(cur);
      cur = cur.parent_id ? topicMap.get(cur.parent_id) : undefined;
    }
    return out;
  }, [topic.data?.parent_id, topicMap]);
  const currentDepth = depthOf(topicMap, topicId);
  const childLevelLabel = levelLabel(currentDepth + 1);

  // Conta quantos filhos diretos (subitens) cada tópico da matéria possui,
  // a partir dos tópicos já carregados em subjectTopics.
  const childrenCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const tp of subjectTopics.data ?? []) {
      if (tp.parent_id) map.set(tp.parent_id, (map.get(tp.parent_id) ?? 0) + 1);
    }
    return map;
  }, [subjectTopics.data]);

  const subtopics = useQuery({
    queryKey: ["subtopics", topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, article_range, order_index, source_id, flashcards(count)")
        .eq("parent_id", topicId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reorderSubtopics = useMutation({
    mutationFn: async (ids: string[]) => persistTreeOrder("topics", ids),
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ["subtopics", topicId] });
      type SubtopicRow = NonNullable<typeof subtopics.data>[number];
      const prev = qc.getQueryData<SubtopicRow[]>(["subtopics", topicId]);
      if (prev) {
        const map = new Map(prev.map((subtopic) => [subtopic.id, subtopic]));
        qc.setQueryData(["subtopics", topicId], ids.map((id) => map.get(id)).filter(Boolean));
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["subtopics", topicId], ctx.prev);
      toast.error(e instanceof Error ? e.message : T("Erro ao reordenar"));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["subtopics", topicId] });
      qc.invalidateQueries({ queryKey: ["topics"] });
    },
  });

  const cards = useQuery({
    queryKey: ["cards", topicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select(
          "id, question, answer, due_date, repetitions, order_index, linked_note_id, image_url, image_category_id, video_url_1, video_url_2, language, source_id, user_modified, linked_note:notes!flashcards_linked_note_id_fkey(id, title)",
        )
        .eq("topic_id", topicId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("question", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CardRow[];
    },
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      await persistCardOrder(ids);
      return ids;
    },
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ["cards", topicId] });
      const prev = qc.getQueryData<CardRow[]>(["cards", topicId]);
      if (prev) {
        const byId = new Map(prev.map((c) => [c.id, c]));
        const next: CardRow[] = [];
        for (const { id, order_index } of renumber(ids)) {
          const card = byId.get(id);
          if (card) next.push({ ...card, order_index });
        }
        qc.setQueryData(["cards", topicId], next);
      }
      return { prev };
    },
    onError: (e, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(["cards", topicId], ctx.prev);
      toast.error(e instanceof Error ? e.message : t.common.error);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["cards", topicId] });
      qc.invalidateQueries({ queryKey: ["flashcards-list"] });
    },
  });

  const topicReviewScope = useQuery({
    queryKey: ["topic-review-scope", topicId],
    queryFn: async () => {
      const { data: childTopics, error: childTopicsError } = await supabase
        .from("topics")
        .select("id")
        .eq("parent_id", topicId);
      if (childTopicsError) throw childTopicsError;

      const topicIds = [topicId, ...(childTopics ?? []).map((child) => child.id)];
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, due_date, topics!inner(review_enabled)")
        .in("topic_id", topicIds);
      if (error) throw error;

      const today = todayLocal();
      const rows = data ?? [];
      return {
        total: rows.length,
        due: rows.filter((card) => {
          const topicEnabled = card.topics?.review_enabled ?? true;
          return topicEnabled && card.due_date <= today;
        }).length,
      };
    },
  });

  const plan = usePlanLimit();
  const saveFlashcards = useServerFn(saveFlashcardsAtomically);
  const upgrade = useUpgradeDialog();
  const createActionRef = useRef<{ signature: string; actionId: string } | null>(null);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [linkedId, setLinkedId] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imageCat, setImageCat] = useState<string | null>(null);
  const [video1, setVideo1] = useState<string | null>(null);
  const [video2, setVideo2] = useState<string | null>(null);

  const [editing, setEditing] = useState<CardRow | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [editOrder, setEditOrder] = useState<string>("");
  const [editLinked, setEditLinked] = useState<string | null>(null);
  const [editImagePath, setEditImagePath] = useState<string | null>(null);
  const [editImageCat, setEditImageCat] = useState<string | null>(null);
  const [editVideo1, setEditVideo1] = useState<string | null>(null);
  const [editVideo2, setEditVideo2] = useState<string | null>(null);
  const [editLanguage, setEditLanguage] = useState<string | null>(null);

  const [subOpen, setSubOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [subArticles, setSubArticles] = useState("");
  const [editTopic, setEditTopic] = useState<EditableTopic | null>(null);
  const [cardSearch, setCardSearch] = useState("");
  const [moveSelf, setMoveSelf] = useState(false);
  const [moveSub, setMoveSub] = useState<{ id: string; name: string } | null>(null);

  const createSubtopic = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      if (!topic.data?.subject_id) throw new Error(t.common.error);
      const { error } = await supabase.from("topics").insert({
        user_id: u.user.id,
        subject_id: topic.data.subject_id,
        parent_id: topicId,
        name: subName.trim(),
        article_range: subArticles.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.topic.subtopicCreated);
      setSubName("");
      setSubArticles("");
      setSubOpen(false);
      qc.invalidateQueries({ queryKey: ["subtopics", topicId] });
      qc.invalidateQueries({ queryKey: ["topic-review-scope", topicId] });
      qc.invalidateQueries({ queryKey: ["topic-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  function openEdit(c: CardRow) {
    setEditing(c);
    setEditQ(c.question);
    setEditA(c.answer);
    setEditOrder(c.order_index != null ? String(c.order_index) : "");
    setEditLinked(c.linked_note_id);
    setEditImagePath(c.image_url);
    setEditImageCat(c.image_category_id);
    setEditVideo1(c.video_url_1 ?? null);
    setEditVideo2(c.video_url_2 ?? null);
    setEditLanguage(c.language ?? null);
  }

  const search = Route.useSearch();
  const openedEditRef = useRef<string | null>(null);
  useEffect(() => {
    const editId = search.edit;
    if (!editId || !cards.data) return;
    if (openedEditRef.current === editId) return;
    const found = cards.data.find((c) => c.id === editId);
    if (found) {
      openedEditRef.current = editId;
      openEdit(found);
      router.navigate({
        to: "/topics/$topicId",
        params: { topicId },
        search: { edit: undefined },
        replace: true,
      });
    }
  }, [search.edit, cards.data, router, topicId]);

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      if (!plan.canCreate(1)) {
        upgrade.show();
        throw new Error("LIMIT");
      }
      const card = {
        topicId,
        question: q.trim(),
        answer: a.trim(),
        orderIndex: extractOrderFromText(a) ?? extractOrderFromText(q),
        linkedNoteId: linkedId,
        imageUrl: imagePath,
        imageCategoryId: imageCat,
        videoUrl1: video1,
        videoUrl2: video2,
      };
      const signature = JSON.stringify(card);
      if (createActionRef.current?.signature !== signature) {
        createActionRef.current = { signature, actionId: crypto.randomUUID() };
      }
      return saveFlashcards({
        data: {
          actionId: createActionRef.current.actionId,
          cards: [card],
        },
      });
    },
    onSuccess: (saved) => {
      createActionRef.current = null;
      toast.success(
        saved.chargedCoins > 0
          ? T("Concluído com {coins} FlashCoins debitadas. Saldo disponível: {balance}.", {
              coins: saved.chargedCoins,
              balance: saved.balance.toLocaleString(),
            })
          : t.topic.created,
      );
      setQ("");
      setA("");
      setLinkedId(null);
      setImagePath(null);
      setImageCat(null);
      setVideo1(null);
      setVideo2(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["cards", topicId] });
      qc.invalidateQueries({ queryKey: ["topic-review-scope", topicId] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
      qc.invalidateQueries({ queryKey: ["account-overview"] });
      qc.invalidateQueries({ queryKey: ["flashcoins"] });
      qc.invalidateQueries({ queryKey: ["ai-billing"] });
    },
    onError: (e) => {
      if ((e as Error).message !== "LIMIT")
        toast.error(e instanceof Error ? e.message : t.common.error);
    },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const parsed = editOrder.trim() === "" ? null : parseInt(editOrder, 10);
      const { error } = await supabase
        .from("flashcards")
        .update({
          question: editQ.trim(),
          answer: editA.trim(),
          order_index: Number.isFinite(parsed as number) ? parsed : null,
          linked_note_id: editLinked,
          image_url: editImagePath,
          image_category_id: editImageCat,
          video_url_1: editVideo1,
          video_url_2: editVideo2,
          language: editLanguage,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.flashLink.cardUpdated);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["cards", topicId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const cardRow = (cards.data ?? []).find((card) => card.id === id);
      if ((cardRow?.source_id || isPurchased) && !plan.isAppManager)
        throw new Error(purchasedTexts.cannotDeleteItem);
      const { error } = await supabase.from("flashcards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards", topicId] });
      qc.invalidateQueries({ queryKey: ["topic-review-scope", topicId] });
      toast.success(t.topic.removed);
    },
  });

  const removeTopic = useMutation({
    mutationFn: async () => {
      if (isPurchased && !plan.isAppManager) throw new Error(purchasedTexts.cannotDeleteItem);
      const { error } = await supabase.from("topics").delete().eq("id", topicId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.topic.topicRemoved);
      qc.invalidateQueries({ queryKey: ["subtopics"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["topic-counts"] });
      if (topic.data?.parent_id) {
        router.navigate({
          to: "/topics/$topicId",
          params: { topicId: topic.data.parent_id },
          search: { edit: undefined },
        });
      } else if (topic.data?.subject_id) {
        router.navigate({
          to: "/subjects/$subjectId",
          params: { subjectId: topic.data.subject_id },
        });
      } else {
        router.navigate({ to: "/review" });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const removeSubtopic = useMutation({
    mutationFn: async (id: string) => {
      const sub = (subtopics.data ?? []).find((subtopic) => subtopic.id === id);
      if ((sub?.source_id || isPurchased) && !plan.isAppManager)
        throw new Error(purchasedTexts.cannotDeleteItem);
      const { error } = await supabase.from("topics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.topic.topicRemoved);
      qc.invalidateQueries({ queryKey: ["subtopics", topicId] });
      qc.invalidateQueries({ queryKey: ["topic-review-scope", topicId] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const renameTopic = useMutation({
    mutationFn: async (v: { id: string; name: string; article_range?: string | null }) => {
      const patch: { name: string; article_range?: string | null } = { name: v.name };
      if (v.article_range !== undefined) patch.article_range = v.article_range;
      const { error } = await supabase.from("topics").update(patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(T("Nome atualizado"));
      setEditTopic(null);
      qc.invalidateQueries({ queryKey: ["subject-topics"] });
      qc.invalidateQueries({ queryKey: ["topics"] });
      qc.invalidateQueries({ queryKey: ["topic", topicId] });
      if (v.id !== topicId) qc.invalidateQueries({ queryKey: ["subtopics", topicId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const toggleReview = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("topics")
        .update({ review_enabled: enabled })
        .eq("id", topicId);
      if (error) throw error;
    },
    onSuccess: (_d, enabled) => {
      qc.invalidateQueries({ queryKey: ["topic", topicId] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["study-queue"] });
      qc.invalidateQueries({ queryKey: ["topic-review-scope", topicId] });
      toast.success(enabled ? t.topic.reactivated : t.topic.paused);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const reviewEnabled = topic.data?.review_enabled ?? true;
  const directDueCount = (cards.data ?? []).filter(
    (c) => new Date(c.due_date) <= new Date(),
  ).length;
  const dueCount = reviewEnabled ? (topicReviewScope.data?.due ?? directDueCount) : 0;
  const reviewableTotal = topicReviewScope.data?.total ?? (cards.data ?? []).length;
  const dateFmt =
    lang === "pt" || lang === "pt-PT" || lang === "es"
      ? "dd 'de' MMM"
      : lang === "de"
        ? "dd. MMM"
        : lang === "fr" || lang === "it"
          ? "dd MMM"
          : "MMM dd";

  const myUserId = useQuery({
    queryKey: ["my-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "",
    staleTime: Infinity,
  }).data;

  const isOfficial = Boolean(myUserId && topic.data?.user_id && topic.data.user_id !== myUserId);
  // Conteúdo de pacote adquirido: somente o AppManager pode excluir.
  const isPurchased = Boolean(topic.data?.source_id || topic.data?.subjects?.source_id);
  const canDelete = !isOfficial && (!isPurchased || plan.isAppManager);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
        {topic.data?.parent_id ? (
          <Link
            to="/topics/$topicId"
            params={{ topicId: topic.data.parent_id }}
            search={{ edit: undefined }}
            className="inline-flex items-center hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />{" "}
            {parentTopic.data ? topicDisplayName(parentTopic.data) : t.topic.backToParent}
          </Link>
        ) : topic.data?.subject_id ? (
          <Link
            to="/subjects/$subjectId"
            params={{ subjectId: topic.data.subject_id }}
            className="inline-flex items-center hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> {topic.data?.subjects?.name ?? t.common.back}
          </Link>
        ) : null}
        {topic.data?.subject_id && (ancestors.length > 0 || topic.data?.parent_id) ? (
          <span className="ml-2 inline-flex flex-wrap items-center gap-1">
            <Link
              to="/subjects/$subjectId"
              params={{ subjectId: topic.data.subject_id }}
              className="hover:text-foreground"
            >
              {topic.data?.subjects?.name}
            </Link>
            {ancestors.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1">
                <span>›</span>
                <Link
                  to="/topics/$topicId"
                  params={{ topicId: a.id }}
                  search={{ edit: undefined }}
                  className="hover:text-foreground"
                >
                  {topicDisplayName(a)}
                </Link>
              </span>
            ))}
            <span>› {topic.data ? topicDisplayName(topic.data) : ""}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{t.topic.label}</p>
          <div className="flex items-center gap-2">
            <h1 className="text-4xl font-serif">
              {topic.data ? topicDisplayName(topic.data) : "…"}
            </h1>
            {isOfficial && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                {T("Oficial")}
              </span>
            )}
            {topic.data && !isOfficial && (
              <Button
                variant="ghost"
                size="sm"
                aria-label={T("Renomear")}
                onClick={() =>
                  setEditTopic({
                    id: topicId,
                    name: topic.data!.name,
                    article_range: topic.data!.article_range,
                  })
                }
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {t.topic.cardsInfo(cards.data?.length ?? 0, dueCount)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {dueCount > 0 ? (
            <Button
              variant="secondary"
              onClick={() => router.navigate({ to: "/study", search: { topic: topicId } })}
            >
              <Play className="h-4 w-4 mr-1" /> {t.topic.review(dueCount)}
            </Button>
          ) : reviewableTotal > 0 ? (
            <Button
              variant="secondary"
              onClick={() =>
                router.navigate({ to: "/study", search: { topic: topicId, all: true } })
              }
            >
              <Play className="h-4 w-4 mr-1" /> {t.topic.reviewNow}
            </Button>
          ) : null}
          {!isOfficial && (
            <>
              <Dialog open={subOpen} onOpenChange={setSubOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={currentDepth + 1 > 5}>
                    <Plus className="h-4 w-4 mr-1" />
                    {T("Novo")} {childLevelLabel.toLowerCase()}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {T("Criar")} {childLevelLabel.toLowerCase()}
                    </DialogTitle>
                  </DialogHeader>
                  <VoiceInput
                    label={childLevelLabel}
                    value={subName}
                    onChange={setSubName}
                    placeholder={t.topic.subtopicNamePh}
                    minRows={2}
                  />
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                      {t.subject.articleRange}
                    </label>
                    <Input
                      value={subArticles}
                      onChange={(e) => setSubArticles(e.target.value.slice(0, 80))}
                      placeholder={t.subject.articleRangePh}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createSubtopic.mutate()}
                      disabled={!subName.trim() || createSubtopic.isPending}
                    >
                      {createSubtopic.isPending ? t.common.saving : t.common.create}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-1" />
                    {t.topic.newCard}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t.topic.createCard}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <VoiceInput
                      label={t.topic.question}
                      value={q}
                      onChange={setQ}
                      placeholder={t.topic.questionPh}
                    />
                    <VoiceInput
                      label={t.topic.answer}
                      value={a}
                      onChange={setA}
                      placeholder={t.topic.answerPh}
                    />
                    <NoteLinkPicker value={linkedId} onChange={setLinkedId} />
                    <MindMapPicker
                      imagePath={imagePath}
                      categoryId={imageCat}
                      onChange={({ imagePath: p, categoryId: c }) => {
                        setImagePath(p);
                        setImageCat(c);
                      }}
                    />
                    <VideoLinksPicker
                      video1={video1}
                      video2={video2}
                      onChange={({ video1: v1, video2: v2 }) => {
                        setVideo1(v1);
                        setVideo2(v2);
                      }}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => create.mutate()}
                      disabled={!q.trim() || !a.trim() || create.isPending}
                    >
                      {create.isPending ? t.common.saving : t.common.save}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="sm"
                aria-label={T("Mover")}
                title={T("Mover para outra matéria ou assunto")}
                onClick={() => setMoveSelf(true)}
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
              {canDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.topic.removeTopic}
                  onClick={() => {
                    if (confirm(t.topic.confirmRemoveTopic)) removeTopic.mutate();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <span
                  className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground"
                  title={purchasedTexts.cannotDeleteItem}
                  aria-label={purchasedTexts.cannotDeleteItem}
                >
                  <Lock className="h-4 w-4" />
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {!isOfficial && (
        <Card className="p-3 flex items-center gap-3">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${reviewEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            {reviewEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{t.topic.autoReview}</p>
              <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                {reviewEnabled ? t.topic.autoReviewOn : t.topic.autoReviewOff}
              </p>
            </div>
            <Switch
              checked={reviewEnabled}
              disabled={toggleReview.isPending || topic.isLoading}
              onCheckedChange={(v) => toggleReview.mutate(v)}
            />
          </div>
        </Card>
      )}

      {(subtopics.data ?? []).length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-serif">{t.topic.subtopics}</h2>
          <SortableList
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            layout="grid"
            ids={subtopics.data!.map((subtopic) => subtopic.id)}
            onReorder={(ids) => reorderSubtopics.mutate(ids)}
          >
            {subtopics.data!.map((subtopic) => {
              const count = subtopic.flashcards?.[0]?.count ?? 0;
              const childCount = childrenCountMap.get(subtopic.id) ?? 0;
              const childDepth = currentDepth + 2;
              const childLevel =
                childCount > 1 && childDepth === 1
                  ? t.subject.subtopicMany
                  : childCount > 1 && childDepth === 2
                    ? t.subject.subitemMany
                    : levelLabel(childDepth);
              return (
                <SortableItem key={subtopic.id} id={subtopic.id}>
                  {(handle) => (
                    <div className="relative">
                      <Link
                        to="/topics/$topicId"
                        params={{ topicId: subtopic.id }}
                        search={{ edit: undefined }}
                      >
                        <Card className="p-4 pr-28 hover:shadow-card transition h-full">
                          <h3 className="font-serif text-lg">{topicDisplayName(subtopic)}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {count} {count === 1 ? t.subject.cardsOne : t.subject.cardsMany}
                          </p>
                          {childCount > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {childCount} {childLevel}
                            </p>
                          )}
                        </Card>
                      </Link>
                      <div className="absolute bottom-2 right-2">{handle}</div>
                      {!isOfficial && (
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={T("Renomear")}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditTopic({
                                id: subtopic.id,
                                name: subtopic.name,
                                article_range: subtopic.article_range,
                              });
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={T("Mover")}
                            title={T("Mover para outra matéria ou assunto")}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMoveSub({ id: subtopic.id, name: subtopic.name });
                            }}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                          {(subtopic.source_id || isPurchased) && !plan.isAppManager ? (
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
                              aria-label={t.topic.removeTopic}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(t.topic.confirmRemoveTopic))
                                  removeSubtopic.mutate(subtopic.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </SortableItem>
              );
            })}
          </SortableList>
        </div>
      )}

      <TopicMatchGames
        topicId={topicId}
        cards={(cards.data ?? []).map((c) => ({ question: c.question, answer: c.answer }))}
        language={cards.data?.[0]?.language ?? null}
      />

      {cards.isLoading ? (
        <div className="text-sm text-muted-foreground">{t.common.loading}</div>
      ) : (cards.data ?? []).length === 0 ? (
        (subtopics.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center bg-card/40 max-w-md mx-auto">
            <Layers className="h-8 w-8 mx-auto text-muted-foreground" />
            <h3 className="mt-3 font-serif text-lg">{t.topic.emptyTitle}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t.topic.emptyHint}</p>
          </div>
        ) : null
      ) : (
        (() => {
          const s = cardSearch.trim().toLowerCase();
          const list = s
            ? cards.data!.filter(
                (c) => c.question.toLowerCase().includes(s) || c.answer.toLowerCase().includes(s),
              )
            : cards.data!;
          return (
            <div className="space-y-2">
              {(subtopics.data ?? []).length > 0 && (
                <h2 className="text-xl font-serif pt-2">{T("Flashcards deste assunto")}</h2>
              )}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8 pr-12"
                  placeholder={T("Buscar por palavras na pergunta ou resposta…")}
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                />
                <MicButton
                  value={cardSearch}
                  onChange={setCardSearch}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                />
              </div>
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">
                  {T("Nenhum flashcard encontrado.")}
                </p>
              )}
              <SortableList
                className="space-y-2"
                ids={list.map((c) => c.id)}
                disabled={!!s}
                onReorder={(ids) => reorder.mutate(ids)}
              >
                {list.map((c) => {
                  const isDue = isPast(new Date(c.due_date)) || c.due_date === todayLocal();
                  return (
                    <SortableItem key={c.id} id={c.id} disabled={!!s}>
                      {(handle) => (
                        <Card className="p-4 flex items-start gap-3">
                          {handle}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {c.order_index != null && (
                                <span className="text-muted-foreground mr-1">#{c.order_index}</span>
                              )}
                              {c.question}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{c.answer}</p>
                            {c.source_id && (
                              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                                {c.user_modified ? T("Alterado por você") : T("Do autor")}
                              </span>
                            )}
                            {c.linked_note && (
                              <Link
                                to="/notes"
                                search={{ id: c.linked_note.id }}
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                              >
                                <Link2 className="h-3 w-3" />
                                {c.linked_note.title || t.notes.untitled}
                              </Link>
                            )}
                            <p className="text-xs mt-1">
                              <span
                                className={
                                  isDue ? "text-accent font-medium" : "text-muted-foreground"
                                }
                              >
                                {isDue
                                  ? t.topic.reviewToday
                                  : t.topic.reviewOn(
                                      format(new Date(c.due_date), dateFmt, { locale }),
                                    )}
                              </span>
                              {c.repetitions > 0 && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {t.topic.reviewsCount(c.repetitions)}
                                </span>
                              )}
                            </p>
                          </div>
                          {!isOfficial && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(c)}
                                aria-label={t.flashLink.editCard}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {(c.source_id || isPurchased) && !plan.isAppManager ? (
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
                                    if (confirm(t.topic.confirmRemoveCard)) remove.mutate(c.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                        </Card>
                      )}
                    </SortableItem>
                  );
                })}
              </SortableList>
            </div>
          );
        })()
      )}

      {/* Edit dialog */}
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
                <div className="text-xs text-muted-foreground font-normal truncate max-w-full">
                  {[
                    topic.data?.subjects?.name,
                    parentTopic.data ? topicDisplayName(parentTopic.data) : undefined,
                    topic.data ? topicDisplayName(topic.data) : undefined,
                  ]
                    .filter(Boolean)
                    .join(" › ")}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <VoiceInput
              label={t.topic.question}
              value={editQ}
              onChange={setEditQ}
              placeholder={t.topic.questionPh}
            />
            <VoiceInput
              label={t.topic.answer}
              value={editA}
              onChange={setEditA}
              placeholder={t.topic.answerPh}
            />
            <div>
              <label className="text-sm font-medium block mb-1">{T("Ordem (opcional)")}</label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={T("ex.: 12 (nº do artigo)")}
                value={editOrder}
                onChange={(e) => setEditOrder(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {T("Define a posição de exibição/revisão. Deixe vazio para usar a ordem padrão.")}
              </p>
            </div>
            <LanguageSelect
              label={t.subject.cardLanguage}
              noneLabel={t.subject.cardLanguageInherit}
              value={editLanguage}
              onChange={setEditLanguage}
            />
            <NoteLinkPicker value={editLinked} onChange={setEditLinked} />
            <MindMapPicker
              imagePath={editImagePath}
              categoryId={editImageCat}
              onChange={({ imagePath: p, categoryId: c }) => {
                setEditImagePath(p);
                setEditImageCat(c);
              }}
            />
            <VideoLinksPicker
              video1={editVideo1}
              video2={editVideo2}
              onChange={({ video1: v1, video2: v2 }) => {
                setEditVideo1(v1);
                setEditVideo2(v2);
              }}
            />
          </div>
          <DialogFooter className="gap-2">
            {editA !== "" && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (confirm(t.topic.confirmClearAnswer)) setEditA("");
                }}
              >
                {t.topic.clearAnswer}
              </Button>
            )}
            <Button
              onClick={() => update.mutate()}
              disabled={!editQ.trim() || !editA.trim() || update.isPending}
            >
              {update.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveTopicDialog
        open={moveSelf}
        onOpenChange={setMoveSelf}
        topicId={topicId}
        topicName={topic.data?.name}
        currentSubjectId={topic.data?.subject_id}
        onMoved={() => qc.invalidateQueries({ queryKey: ["topic", topicId] })}
      />
      <EditTopicDialog
        topic={editTopic}
        onClose={() => setEditTopic(null)}
        saving={renameTopic.isPending}
        onSave={(v) => renameTopic.mutate(v)}
      />
      <MoveTopicDialog
        open={!!moveSub}
        onOpenChange={(v) => {
          if (!v) setMoveSub(null);
        }}
        topicId={moveSub?.id ?? ""}
        topicName={moveSub?.name}
        currentSubjectId={topic.data?.subject_id}
        onMoved={() => qc.invalidateQueries({ queryKey: ["subtopics", topicId] })}
      />
    </div>
  );
}
