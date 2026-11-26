import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { T } from "@/lib/i18n-ui";
import { pageHead } from "@/lib/page-head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  ChevronLeft,
  Layers,
  Trash2,
  Pencil,
  Loader2,
  Search,
  Play,
  ArrowRightLeft, BookOpen,
  Lock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { VoiceInput } from "@/components/VoiceInput";
import { MicButton } from "@/components/MicButton";
import { subjectColor } from "./review";
import { useT, useLang } from "@/lib/i18n";
import { usePurchasedTexts } from "@/lib/i18n-purchased";
import { usePlanLimit } from "@/lib/plan-limit";
import { MoveTopicDialog } from "@/components/MoveTopicDialog";
import { todayLocal } from "@/lib/today";
import { SortableList, SortableItem } from "@/components/SortableList";
import { persistTreeOrder } from "@/lib/reorder-tree";
import { topicDisplayName } from "@/lib/topic-tree";
import { EditTopicDialog, type EditableTopic } from "@/components/EditTopicDialog";
import { LanguageSelect } from "@/components/LanguageSelect";

export const Route = createFileRoute("/_authenticated/subjects/$subjectId")({
  head: () =>
    pageHead(
      "Assuntos da matéria — FlashPilot",
      "Organize assuntos e flashcards desta matéria no FlashPilot.",
    ),
  component: SubjectPage,
});

function SubjectPage() {
  const { subjectId } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();
  const t = useT();
  const { lang } = useLang();
  const purchasedTexts = usePurchasedTexts(lang);
  const { isAppManager } = usePlanLimit();

  const subject = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("id", subjectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const topics = useQuery({
    queryKey: ["topics", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, article_range, parent_id, order_index, flashcards(count)")
        .eq("subject_id", subjectId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .limit(5000);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const childrenOf = new Map<string | null, any[]>();
      for (const r of rows) {
        const arr = childrenOf.get(r.parent_id ?? null) ?? [];
        arr.push(r);
        childrenOf.set(r.parent_id ?? null, arr);
      }
      // contagens recursivas (todos os níveis abaixo)
      const agg = (id: string): { cards: number; descendants: number } => {
        const self = rows.find((r) => r.id === id);
        let cards = self?.flashcards?.[0]?.count ?? 0;
        let descendants = 0;
        for (const child of childrenOf.get(id) ?? []) {
          const sub = agg(child.id);
          cards += sub.cards;
          descendants += 1 + sub.descendants;
        }
        return { cards, descendants };
      };
      return (childrenOf.get(null) ?? []).map((r) => {
        const { cards, descendants } = agg(r.id);
        return { ...r, totalCards: cards, totalDescendants: descendants };
      });
    },
  });

  const reorderTopics = useMutation({
    mutationFn: async (ids: string[]) => persistTreeOrder("topics", ids),
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ["topics", subjectId] });
      const prev = qc.getQueryData<any[]>(["topics", subjectId]);
      if (prev) {
        const map = new Map(prev.map((x) => [x.id, x]));
        qc.setQueryData(["topics", subjectId], ids.map((id) => map.get(id)).filter(Boolean));
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["topics", subjectId], ctx.prev);
      toast.error(e instanceof Error ? e.message : T("Erro ao reordenar"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["topics", subjectId] }),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [newArticles, setNewArticles] = useState("");
  const [editTopic, setEditTopic] = useState<EditableTopic | null>(null);
  const [search, setSearch] = useState("");

  const cardsInSubject = useQuery({
    queryKey: ["subject-cards", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select(
          "id, question, answer, due_date, topic_id, topics!inner(id, name, subject_id, review_enabled)",
        )
        .eq("topics.subject_id", subjectId)
        .order("question", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      const { error } = await supabase.from("topics").insert({
        user_id: u.user.id,
        subject_id: subjectId,
        name: name.trim(),
        article_range: newArticles.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.subject.created);
      setName("");
      setNewArticles("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["topics", subjectId] });
      qc.invalidateQueries({ queryKey: ["topic-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const del = useMutation({
    mutationFn: async () => {
      if ((subject.data as any)?.source_id && !isAppManager)
        throw new Error(purchasedTexts.cannotDelete);
      // Apaga em ordem para evitar qualquer bloqueio de FK: flashcards → topics → subject.
      const { data: tps, error: eTops } = await supabase
        .from("topics")
        .select("id")
        .eq("subject_id", subjectId);
      if (eTops) throw eTops;
      const topicIds = (tps ?? []).map((t) => t.id);
      if (topicIds.length > 0) {
        const { error: eFc } = await supabase.from("flashcards").delete().in("topic_id", topicIds);
        if (eFc) throw eFc;
        const { error: eTp } = await supabase.from("topics").delete().in("id", topicIds);
        if (eTp) throw eTp;
      }
      const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.subject.removed);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["topics", subjectId] });
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["fc-list-subjects"] });
      qc.invalidateQueries({ queryKey: ["fc-list-topics"] });
      qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["favorites-count"] });
      qc.invalidateQueries({ queryKey: ["bulk-subjects"] });
      qc.invalidateQueries({ queryKey: ["bulk-topics"] });
      setConfirmDelSubject(false);
      router.navigate({ to: "/review" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const [pendingTopicId, setPendingTopicId] = useState<string | null>(null);
  const [confirmDelSubject, setConfirmDelSubject] = useState(false);
  const [confirmDelTopic, setConfirmDelTopic] = useState<{ id: string; name: string } | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [moveTopic, setMoveTopic] = useState<{ id: string; name: string } | null>(null);

  const otherSubjects = useQuery({
    queryKey: ["subjects-other", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name")
        .neq("id", subjectId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const moveAll = useMutation({
    mutationFn: async () => {
      if (!moveTarget) throw new Error(T("Selecione a matéria de destino"));
      const { error } = await supabase
        .from("topics")
        .update({ subject_id: moveTarget })
        .eq("subject_id", subjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(T("Assuntos transferidos"));
      setMoveOpen(false);
      setMoveTarget("");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const convertToTopic = useMutation({
    mutationFn: async () => {
      if (!moveTarget) throw new Error(T("Selecione a matéria de destino"));
      if (!subject.data) throw new Error(T("Matéria não carregada"));
      if ((subject.data as any)?.source_id && !isAppManager)
        throw new Error(purchasedTexts.cannotDelete);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);

      // 1) Create a new root topic in destination subject with this subject's name
      const { data: newTopic, error: eIns } = await supabase
        .from("topics")
        .insert({
          user_id: u.user.id,
          subject_id: moveTarget,
          name: subject.data.name,
          parent_id: null,
        })
        .select("id")
        .single();
      if (eIns) throw eIns;

      // 2) Fetch all topics currently under this subject
      const { data: allTopics, error: eAll } = await supabase
        .from("topics")
        .select("id, parent_id")
        .eq("subject_id", subjectId);
      if (eAll) throw eAll;
      const ids = (allTopics ?? []).map((tp) => tp.id).filter((id) => id !== newTopic.id);
      const rootIds = (allTopics ?? [])
        .filter((tp) => tp.parent_id === null && tp.id !== newTopic.id)
        .map((tp) => tp.id);

      // 3) Move all topics to destination subject
      if (ids.length > 0) {
        const { error: eSub } = await supabase
          .from("topics")
          .update({ subject_id: moveTarget })
          .in("id", ids);
        if (eSub) throw eSub;
      }
      // 4) Reparent the former roots under the new topic
      if (rootIds.length > 0) {
        const { error: eParent } = await supabase
          .from("topics")
          .update({ parent_id: newTopic.id })
          .in("id", rootIds);
        if (eParent) throw eParent;
      }

      // 5) Delete now-empty subject
      const { error: eDel } = await supabase.from("subjects").delete().eq("id", subjectId);
      if (eDel) throw eDel;
    },
    onSuccess: () => {
      toast.success(T("Matéria convertida em assunto"));
      setMoveOpen(false);
      setMoveTarget("");
      qc.invalidateQueries();
      router.navigate({ to: "/review" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const removeTopic = useMutation({
    mutationFn: async (id: string) => {
      setPendingTopicId(id);
      if ((subject.data as any)?.source_id && !isAppManager)
        throw new Error(purchasedTexts.cannotDeleteItem);
      const { error: eFc } = await supabase.from("flashcards").delete().eq("topic_id", id);
      if (eFc) throw eFc;
      const { error } = await supabase.from("topics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.topic.removed);
      qc.invalidateQueries({ queryKey: ["topics", subjectId] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["fc-list-topics"] });
      qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["favorites-count"] });
      qc.invalidateQueries({ queryKey: ["bulk-topics"] });
      qc.invalidateQueries({ queryKey: ["topic-counts"] });
      setConfirmDelTopic(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
    onSettled: () => setPendingTopicId(null),
  });

  const rename = useMutation({
    mutationFn: async (newName: string) => {
      const { error } = await supabase
        .from("subjects")
        .update({ name: newName })
        .eq("id", subjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.subjectPage.nameUpdated);
      qc.invalidateQueries({ queryKey: ["subject", subjectId] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const setLanguage = useMutation({
    mutationFn: async (value: string | null) => {
      const { error } = await supabase
        .from("subjects")
        .update({ language: value })
        .eq("id", subjectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subject", subjectId] });
      qc.invalidateQueries({ queryKey: ["subjects"] });
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
    onSuccess: () => {
      toast.success(t.subjectPage.topicUpdated);
      setEditTopic(null);
      qc.invalidateQueries({ queryKey: ["topics", subjectId] });
      qc.invalidateQueries({ queryKey: ["topic"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  function askRename(current: string, onOk: (v: string) => void) {
    const v = window.prompt(t.subjectPage.renamePrompt, current);
    if (v && v.trim() && v.trim() !== current) onOk(v.trim());
  }

  const today = todayLocal();
  const myUserId = useQuery({
    queryKey: ["my-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "",
    staleTime: Infinity,
  }).data;

  const subjectDueCount = (cardsInSubject.data ?? []).filter((card: any) => {
    const topicEnabled = card.topics?.review_enabled ?? true;
    return topicEnabled && card.due_date <= today;
  }).length;

  const isOfficial = Boolean(
    myUserId && (subject.data as any)?.user_id && (subject.data as any).user_id !== myUserId,
  );
  // Cópia de pacote adquirido: somente o AppManager pode excluir.
  const isPurchased = Boolean((subject.data as any)?.source_id);
  const canDelete = !isOfficial && (!isPurchased || isAppManager);

  return (
    <div className="space-y-6">
      <Link
        to="/review"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t.subject.all}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="hidden sm:flex h-14 w-14 shrink-0 rounded-2xl items-center justify-center text-white shadow-card"
            style={{ background: subject.data ? subjectColor(subject.data.color) : undefined }}
          >
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {t.subject.label}
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-serif">{subject.data?.name ?? "…"}</h1>
              {isOfficial ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                  {T("Oficial")}
                </span>
              ) : isPurchased ? (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                  {purchasedTexts.badge}
                </span>
              ) : null}
              {subject.data && !isOfficial && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t.subjectPage.renameSubject}
                  onClick={() => askRename(subject.data!.name, (v) => rename.mutate(v))}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        {!isOfficial && (
          <Button asChild variant="ghost" size="sm" aria-label="E-book" title="E-book da matéria">
            <Link to="/ebook/$subjectId" params={{ subjectId }}><BookOpen className="h-4 w-4" /></Link>
          </Button>
        )}
        {!isOfficial && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMoveOpen(true)}
            disabled={(topics.data ?? []).length === 0}
            aria-label={T("Transferir assuntos")}
            title={T("Transferir todos os assuntos para outra matéria")}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            disabled={del.isPending}
            onClick={() => setConfirmDelSubject(true)}
            aria-label={t.subjectPage.deleteSubject}
          >
            {del.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        )}
        {!canDelete && isPurchased && (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            title={purchasedTexts.cannotDelete}
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{purchasedTexts.cannotDelete}</span>
          </span>
        )}
      </div>

      {subject.data && !isOfficial && (
        <div className="max-w-sm">
          <LanguageSelect
            label={t.subject.language}
            noneLabel={t.subject.languageNone}
            hint={t.subject.languageHint}
            value={(subject.data as any).language ?? null}
            disabled={setLanguage.isPending}
            onChange={(v) => setLanguage.mutate(v)}
          />
        </div>
      )}

      <div className="relative">
        <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8 pr-12"
          placeholder={t.subjectPage.searchPh}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <MicButton
          value={search}
          onChange={setSearch}
          className="absolute right-1 top-1/2 -translate-y-1/2"
        />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-serif">{t.subject.topics}</h2>
        <div className="flex items-center gap-2">
          <Link
            to="/study"
            search={
              subjectDueCount > 0 ? { subject: subjectId } : { subject: subjectId, all: true }
            }
          >
            <Button size="sm" variant="secondary">
              <Play className="h-4 w-4 mr-1" />
              {t.subjectPage.reviewSubject}
            </Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t.subject.newTopic}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.subject.createTopic}</DialogTitle>
              </DialogHeader>
              <VoiceInput
                label={t.subject.topicName}
                value={name}
                onChange={setName}
                placeholder={t.subject.topicNamePh}
                minRows={2}
              />
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{t.subject.articleRange}</label>
                <Input
                  value={newArticles}
                  onChange={(e) => setNewArticles(e.target.value.slice(0, 80))}
                  placeholder={t.subject.articleRangePh}
                />
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
                  {create.isPending ? t.common.saving : t.common.create}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {(() => {
        const s = search.trim().toLowerCase();
        const filteredTopics = s
          ? (topics.data ?? []).filter((tp: any) => topicDisplayName(tp).toLowerCase().includes(s))
          : (topics.data ?? []);
        const matchedCards = s
          ? (cardsInSubject.data ?? []).filter(
              (c: any) =>
                c.question.toLowerCase().includes(s) || c.answer.toLowerCase().includes(s),
            )
          : [];
        return (
          <>
            {topics.isLoading ? (
              <div className="text-sm text-muted-foreground">{t.common.loading}</div>
            ) : (topics.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-card/40">
                <Layers className="h-10 w-10 mx-auto text-muted-foreground" />
                <h3 className="mt-4 font-serif text-xl">{t.subject.emptyTitle}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.subject.emptyHint}</p>
              </div>
            ) : filteredTopics.length === 0 && matchedCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.subjectPage.nothingFound(search)}</p>
            ) : (
              <SortableList
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                layout="grid"
                ids={filteredTopics.map((tp: any) => tp.id)}
                disabled={!!s}
                onReorder={(ids) => reorderTopics.mutate(ids)}
              >
                {filteredTopics.map((tp: any) => {
                  const count = tp.totalCards ?? tp.flashcards?.[0]?.count ?? 0;
                  const subtopicCount = tp.totalDescendants ?? 0;

                  return (
                    <SortableItem key={tp.id} id={tp.id} disabled={!!s}>
                      {(handle) => (
                        <div className="relative">
                          <Link
                            to="/topics/$topicId"
                            params={{ topicId: tp.id }}
                            search={{ edit: undefined }}
                          >
                            <Card className="p-5 hover:shadow-card transition h-full">
                              <h3 className="font-serif text-xl pr-24">{topicDisplayName(tp)}</h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {count} {count === 1 ? t.subject.cardsOne : t.subject.cardsMany}
                              </p>
                              {subtopicCount > 0 && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {subtopicCount}{" "}
                                  {subtopicCount === 1
                                    ? t.subject.subtopicOne
                                    : t.subject.subtopicMany}
                                </p>
                              )}
                            </Card>
                          </Link>
                          <div className="absolute bottom-2 right-2">{handle}</div>
                          {!isOfficial && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={t.subjectPage.renameTopic}
                                className="absolute top-2 right-[4.5rem] h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditTopic({
                                    id: tp.id,
                                    name: tp.name,
                                    article_range: tp.article_range,
                                  });
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={T("Mover")}
                                title={T("Mover para outra matéria ou assunto")}
                                className="absolute top-2 right-10 h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setMoveTopic({ id: tp.id, name: tp.name });
                                }}
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" />
                              </Button>
                              {canDelete ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={t.subjectPage.deleteTopic}
                                  className="absolute top-2 right-2 h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  disabled={pendingTopicId === tp.id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConfirmDelTopic({ id: tp.id, name: tp.name });
                                  }}
                                >
                                  {pendingTopicId === tp.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              ) : (
                                <span
                                  className="absolute top-2 right-2 h-8 w-8 inline-flex items-center justify-center text-muted-foreground"
                                  title={purchasedTexts.cannotDeleteItem}
                                  aria-label={purchasedTexts.cannotDeleteItem}
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </SortableItem>
                  );
                })}
              </SortableList>
            )}
            {matchedCards.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {T("Flashcards encontrados ({n})", { n: matchedCards.length })}
                </h3>
                <div className="space-y-2">
                  {matchedCards.map((c: any) => (
                    <Link
                      key={c.id}
                      to="/topics/$topicId"
                      params={{ topicId: c.topic_id }}
                      search={{ edit: c.id }}
                      className="block"
                    >
                      <Card className="p-3 hover:shadow-card transition">
                        <p className="text-sm font-medium truncate">{c.question}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.answer || "—"}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{c.topics?.name}</p>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}

      <AlertDialog
        open={confirmDelSubject}
        onOpenChange={(v) => {
          if (!del.isPending) setConfirmDelSubject(v);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T("Excluir esta matéria?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {T(
                "Todos os tópicos e flashcards de {name} serão apagados definitivamente. Esta ação não pode ser desfeita.",
                { name: subject.data?.name ?? "" },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>{T("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                del.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending ? (
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

      <EditTopicDialog
        topic={editTopic}
        onClose={() => setEditTopic(null)}
        saving={renameTopic.isPending}
        onSave={(v) => renameTopic.mutate(v)}
      />

      <AlertDialog
        open={!!confirmDelTopic}
        onOpenChange={(v) => {
          if (!removeTopic.isPending && !v) setConfirmDelTopic(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T("Excluir este tópico?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {T(
                "O tópico {name} e todos os seus flashcards serão apagados definitivamente. Esta ação não pode ser desfeita.",
                { name: confirmDelTopic?.name ?? "" },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeTopic.isPending}>{T("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeTopic.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelTopic) removeTopic.mutate(confirmDelTopic.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeTopic.isPending ? (
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
        open={moveOpen}
        onOpenChange={(v) => {
          if (!moveAll.isPending && !convertToTopic.isPending) {
            setMoveOpen(v);
            if (!v) setMoveTarget("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{T("Transferir ou converter matéria")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong>{T("Transferir assuntos:")}</strong>{" "}
              {T("move todos os assuntos de {name} como assuntos raiz da matéria destino.", {
                name: subject.data?.name ?? "",
              })}
            </p>
            <p>
              <strong>{T("Converter em assunto:")}</strong>{" "}
              {T(
                "transforma {name} em um único assunto dentro da matéria destino (os assuntos atuais viram subtópicos) e apaga a matéria original.",
                { name: subject.data?.name ?? "" },
              )}
            </p>
          </div>
          <Select value={moveTarget} onValueChange={setMoveTarget}>
            <SelectTrigger>
              <SelectValue placeholder={T("Selecione a matéria de destino")} />
            </SelectTrigger>
            <SelectContent>
              {(otherSubjects.data ?? []).map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setMoveOpen(false)}
              disabled={moveAll.isPending || convertToTopic.isPending}
            >
              {T("Cancelar")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => moveAll.mutate()}
              disabled={!moveTarget || moveAll.isPending || convertToTopic.isPending}
            >
              {moveAll.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {T("Transferindo…")}
                </>
              ) : (
                T("Transferir assuntos")
              )}
            </Button>
            <Button
              onClick={() => convertToTopic.mutate()}
              disabled={!moveTarget || moveAll.isPending || convertToTopic.isPending}
            >
              {convertToTopic.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {T("Convertendo…")}
                </>
              ) : (
                T("Converter em assunto")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveTopicDialog
        open={!!moveTopic}
        onOpenChange={(v) => {
          if (!v) setMoveTopic(null);
        }}
        topicId={moveTopic?.id ?? ""}
        topicName={moveTopic?.name}
        currentSubjectId={subjectId}
        onMoved={() => qc.invalidateQueries({ queryKey: ["topics", subjectId] })}
      />
    </div>
  );
}
