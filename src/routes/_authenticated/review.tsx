import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { T } from "@/lib/i18n-ui";
import { pageHead } from "@/lib/page-head";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  BookOpen,
  Sparkles,
  Bell,
  HelpCircle,
  ArrowRight,
  Rocket,
  Star,
  Search,
  Trash2,
  Loader2,
  BookMarked,
  Lock,
} from "lucide-react";
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
import { toast } from "sonner";
import { VoiceInput } from "@/components/VoiceInput";
import { MicButton } from "@/components/MicButton";
import { useT, useLang } from "@/lib/i18n";
import { usePurchasedTexts } from "@/lib/i18n-purchased";
import { usePlanLimit } from "@/lib/plan-limit";
import { todayLocal } from "@/lib/today";
import { SortableList, SortableItem } from "@/components/SortableList";
import { persistTreeOrder } from "@/lib/reorder-tree";
import { LanguageSelect } from "@/components/LanguageSelect";
import { validatedExtLanguage } from "@/lib/languages";
import { getLandingDraftStatus, processLandingDraft } from "@/lib/landing-draft.functions";
import { landingDraftPollOutcome } from "@/lib/landing-draft-poll";
import { HomeStudyMaterials } from "@/components/HomeStudyMaterials";
import { deliverPendingSubjects } from "@/lib/official-content.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/review")({
  validateSearch: (search: Record<string, unknown>): { actionId?: string; first?: string } => ({
    actionId: typeof search.actionId === "string" ? search.actionId : undefined,
    first: typeof search.first === "string" ? search.first : undefined,
  }),
  head: () =>
    pageHead(
      "Revisar Flashcards — FlashPilot",
      "Escolha suas matérias e revise seus flashcards no FlashPilot.",
    ),
  component: HomePage,
});

const POLL_INTERVAL_MS = 2_500;
const POLL_MAX_ATTEMPTS = 24;

/**
 * Primeiro acesso vindo da landing: dispara a geração dos flashcards do
 * rascunho (actionId) e acompanha o status até concluir, sem recarregar.
 */
function FirstAccessGate({ actionId, onDone }: { actionId: string; onDone: () => void }) {
  const [attempts, setAttempts] = useState(0);
  const [failed, setFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let requestPending = true;
    let observedProcessing = false;
    setFailed(false);
    setAttempts(0);

    const tick = async (attempt: number) => {
      if (!active) return;
      try {
        if (attempt === 0) {
          // Dispara o processamento em background (idempotente no servidor).
          void processLandingDraft({ data: { actionId } })
            .catch(() => {})
            .finally(() => {
              requestPending = false;
            });
        }
        // Snapshot before reading: this response can still contain the previous failure.
        const requestPendingAtRead = requestPending;
        const status = await getLandingDraftStatus({ data: { actionId } });
        if (!active) return;
        const outcome = landingDraftPollOutcome(
          status.status,
          requestPendingAtRead,
          observedProcessing,
        );
        if (status.status === "processing") observedProcessing = true;
        if (outcome === "done") {
          onDone();
          return;
        }
        if (outcome === "failed") {
          setFailed(true);
          return;
        }
      } catch {
        if (!active) return;
      }
      if (attempt + 1 >= POLL_MAX_ATTEMPTS) {
        setFailed(true);
        return;
      }
      setAttempts(attempt + 1);
      timer = setTimeout(() => void tick(attempt + 1), POLL_INTERVAL_MS);
    };

    void tick(0);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId, retryTick]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md space-y-4 p-8 text-center">
        {failed ? (
          <>
            <HelpCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{T("Não conseguimos concluir agora")}</h2>
            <p className="text-sm text-muted-foreground">
              {T(
                "A geração dos seus flashcards demorou mais do que o esperado. Você pode tentar novamente sem perder o texto enviado.",
              )}
            </p>
            <Button onClick={() => setRetryTick((v) => v + 1)} className="w-full">
              <Sparkles />
              {T("Tentar gerar novamente")}
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h2 className="text-lg font-semibold">
              {T("O PilotAI está estruturando seus flashcards...")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {T("Isso leva alguns segundos. Não feche esta página.")}
            </p>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={POLL_MAX_ATTEMPTS}
              aria-valuenow={attempts}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(95, (attempts / POLL_MAX_ATTEMPTS) * 100)}%` }}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

const SUBJECT_COLORS = [
  { key: "indigo", hex: "oklch(0.55 0.15 265)" },
  { key: "coral", hex: "oklch(0.68 0.17 30)" },
  { key: "moss", hex: "oklch(0.6 0.13 155)" },
  { key: "amber", hex: "oklch(0.75 0.15 75)" },
  { key: "violet", hex: "oklch(0.55 0.18 305)" },
  { key: "teal", hex: "oklch(0.6 0.11 200)" },
];

export function subjectColor(key: string) {
  return SUBJECT_COLORS.find((c) => c.key === key)?.hex ?? SUBJECT_COLORS[0].hex;
}

function HomePage() {
  const qc = useQueryClient();
  const router = useRouter();
  const t = useT();
  const { lang, extLang } = useLang();
  const autoSubjectLanguage = validatedExtLanguage(extLang);
  const purchasedTexts = usePurchasedTexts(lang);
  const { isAppManager } = usePlanLimit();
  const { actionId } = Route.useSearch();
  const [gateDone, setGateDone] = useState(false);
  const deliverPendingFn = useServerFn(deliverPendingSubjects);

  // Matérias pagas que ainda não chegaram: entrega em segundo plano e atualiza a lista.
  useEffect(() => {
    let alive = true;
    deliverPendingFn({})
      .then((r) => {
        // Sempre atualiza: a entrega também remove cópias duplicadas, que a lista em cache ainda mostraria.
        if (alive && r) {
          for (const k of [
            "subjects",
            "topic-counts",
            "subject-grants",
            "due-today",
            "my-flashcards-count",
          ]) {
            qc.invalidateQueries({ queryKey: [k] });
          }
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subjects = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, user_id, name, color, order_index, source_id")
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const myUserId = useQuery({
    queryKey: ["my-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? "",
    staleTime: Infinity,
  }).data;

  const reorderSubjects = useMutation({
    mutationFn: async (ids: string[]) => persistTreeOrder("subjects", ids),
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ["subjects"] });
      const prev = qc.getQueryData<any[]>(["subjects"]);
      if (prev) {
        const map = new Map(prev.map((s) => [s.id, s]));
        qc.setQueryData(["subjects"], ids.map((id) => map.get(id)).filter(Boolean));
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["subjects"], ctx.prev);
      toast.error(e instanceof Error ? e.message : T("Erro ao reordenar"));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });

  const topicCounts = useQuery({
    queryKey: ["topic-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("subject_id, parent_id")
        .order("subject_id");
      if (error) throw error;
      return (data ?? []) as { subject_id: string; parent_id: string | null }[];
    },
  });

  const countsBySubject = useMemo(() => {
    const map = new Map<string, { root: number; sub: number }>();
    topicCounts.data?.forEach((tp) => {
      const current = map.get(tp.subject_id) ?? { root: 0, sub: 0 };
      if (tp.parent_id === null) current.root += 1;
      else current.sub += 1;
      map.set(tp.subject_id, current);
    });
    return map;
  }, [topicCounts.data]);

  const [confirmDelSubject, setConfirmDelSubject] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [pendingDelSubjectId, setPendingDelSubjectId] = useState<string | null>(null);

  const delSubject = useMutation({
    mutationFn: async (id: string) => {
      // Matérias adquiridas (cópias de pacotes oficiais) só podem ser removidas pelo AppManager.
      const target = (subjects.data ?? []).find((x: any) => x.id === id) as any;
      if (target?.source_id && !isAppManager) throw new Error(purchasedTexts.cannotDelete);
      setPendingDelSubjectId(id);
      const { data: tps, error: eTops } = await supabase
        .from("topics")
        .select("id")
        .eq("subject_id", id);
      if (eTops) throw eTops;
      const topicIds = (tps ?? []).map((t) => t.id);
      if (topicIds.length > 0) {
        const { error: eFc } = await supabase.from("flashcards").delete().in("topic_id", topicIds);
        if (eFc) throw eFc;
        const { error: eTp } = await supabase.from("topics").delete().in("id", topicIds);
        if (eTp) throw eTp;
      }
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.subject.removed);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["favorites-count"] });
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["fc-list-subjects"] });
      qc.invalidateQueries({ queryKey: ["fc-list-topics"] });
      qc.invalidateQueries({ queryKey: ["bulk-subjects"] });
      qc.invalidateQueries({ queryKey: ["bulk-topics"] });
      setConfirmDelSubject(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
    onSettled: () => setPendingDelSubjectId(null),
  });

  const dueToday = useQuery({
    queryKey: ["due-today"],
    queryFn: async () => {
      const today = todayLocal();
      const { count, error } = await supabase
        .from("flashcards")
        .select("id, topics!inner(review_enabled)", { count: "exact", head: true })
        .eq("topics.review_enabled", true)
        .lte("due_date", today);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const favoritesCount = useQuery({
    queryKey: ["favorites-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("is_favorite", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const missingAnswers = useQuery({
    queryKey: ["missing-answers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, question, topic_id, topics!inner(name, subjects!inner(id, name))")
        .eq("answer", "")
        .order("question", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!dueToday.data) return;
    const key = `notified-${todayLocal()}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    new Notification(t.home.notifHead, {
      body: t.home.notifText(dueToday.data),
      icon: "/icon-192.png",
    });
  }, [dueToday.data, t]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("indigo");
  const [language, setLanguage] = useState<string | null>(autoSubjectLanguage);
  const languageManuallyChanged = useRef(false);
  useEffect(() => {
    if (!languageManuallyChanged.current) setLanguage(autoSubjectLanguage);
  }, [autoSubjectLanguage]);
  const [search, setSearch] = useState("");

  const searchedCards = useQuery({
    queryKey: ["home-search", search.trim().toLowerCase()],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const s = search.trim();
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, question, answer, topic_id, topics!inner(id, name, subjects(id, name))")
        .or(`question.ilike.%${s}%,answer.ilike.%${s}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      const { error } = await supabase.from("subjects").insert({
        user_id: u.user.id,
        name: name.trim(),
        color,
        language,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.home.created);
      setName("");
      setColor("indigo");
      setLanguage(autoSubjectLanguage);
      setOpen(false);
      languageManuallyChanged.current = false;
      qc.invalidateQueries({ queryKey: ["subjects"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  if (actionId && !gateDone) {
    return (
      <FirstAccessGate
        actionId={actionId}
        onDone={() => {
          void qc.invalidateQueries();
          setGateDone(true);
        }}
      />
    );
  }

  return (
    <div className="home-brand space-y-8">
      {actionId && (
        <div className="hidden">
          <HomeStudyMaterials landingActionId={actionId} />
        </div>
      )}
      <section>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{t.home.hello}</p>
            <h1 className="text-4xl font-serif mt-1 brand-gold-text">{t.homeHub.review}</h1>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => router.navigate({ to: "/notebooks" })}>
          <BookMarked className="h-4 w-4 mr-1" /> {t.home.activeSessions}
        </Button>
      </div>

      {(dueToday.data ?? 0) > 0 ? (
        <MissionsCarousel
          subjects={(subjects.data ?? []) as any[]}
          total={dueToday.data ?? 0}
          onReviewAll={() => router.navigate({ to: "/study" })}
        />
      ) : (
        <ReviewTodayCard
          count={0}
          onStart={() => router.navigate({ to: "/study" })}
          onReviewAll={() => router.navigate({ to: "/study", search: { all: true } as any })}
        />
      )}

      {(favoritesCount.data ?? 0) > 0 && (
        <Card className="p-4 flex items-center gap-3 brand-chrome-card border-transparent">
          <div className="h-10 w-10 rounded-full bg-warning/15 flex items-center justify-center shrink-0">
            <Star className="h-5 w-5 text-warning fill-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium">{t.home.favorites}</h4>
            <p className="text-sm text-muted-foreground">
              {t.home.favoritesCount(favoritesCount.data ?? 0)}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.navigate({ to: "/study", search: { favorites: true } as any })}
          >
            {t.home.reviewFavorites}
          </Button>
        </Card>
      )}

      <MissingAnswersSection
        cards={missingAnswers.data ?? []}
        isLoading={missingAnswers.isLoading}
      />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif">{t.home.subjects}</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t.home.newSubject}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.home.createSubject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <VoiceInput
                  label={t.home.subjectName}
                  value={name}
                  onChange={setName}
                  placeholder={t.home.subjectNamePh}
                  minRows={2}
                />
                <div>
                  <p className="text-sm font-medium mb-2">{t.home.color}</p>
                  <div className="flex gap-2 flex-wrap">
                    {SUBJECT_COLORS.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => setColor(c.key)}
                        className={`h-9 w-9 rounded-full border-2 transition ${color === c.key ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ background: c.hex }}
                        aria-label={c.key}
                      />
                    ))}
                  </div>
                </div>
                <LanguageSelect
                  label={t.subject.language}
                  noneLabel={t.subject.languageNone}
                  hint={t.subject.languageHint}
                  value={language}
                  onChange={(value) => {
                    languageManuallyChanged.current = true;
                    setLanguage(value);
                  }}
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

        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 pr-12"
            placeholder={T("Buscar matérias ou flashcards…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <MicButton
            value={search}
            onChange={setSearch}
            className="absolute right-1 top-1/2 -translate-y-1/2"
          />
        </div>

        {(() => {
          const s = search.trim().toLowerCase();
          const list = s
            ? (subjects.data ?? []).filter((x: any) => x.name.toLowerCase().includes(s))
            : (subjects.data ?? []);
          return subjects.isLoading ? (
            <div className="text-sm text-muted-foreground">{t.common.loading}</div>
          ) : (subjects.data ?? []).length === 0 ? (
            <EmptyState onCreate={() => setOpen(true)} />
          ) : list.length === 0 && !s ? null : (
            <SortableList
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              layout="grid"
              ids={list.map((x: any) => x.id)}
              disabled={!!s}
              onReorder={(ids) => reorderSubjects.mutate(ids)}
            >
              {list.map((sj: any) => {
                const counts = countsBySubject.get(sj.id);
                const rootCount = counts?.root ?? 0;
                const subtopicCount = counts?.sub ?? 0;
                const isOfficial = Boolean(myUserId && sj.user_id && sj.user_id !== myUserId);
                const isPurchased = Boolean(sj.source_id);
                const canDelete = !isOfficial && (!isPurchased || isAppManager);
                return (
                  <SortableItem key={sj.id} id={sj.id} disabled={!!s}>
                    {(handle) => (
                      <div className="relative group">
                        <Link to="/subjects/$subjectId" params={{ subjectId: sj.id }}>
                          <Card className="brand-subject-card border-transparent p-5 hover:shadow-card transition h-full flex flex-col justify-between gap-6">
                            <div className="flex items-center justify-between">
                              <div
                                className="h-11 w-11 rounded-xl flex items-center justify-center text-white"
                                style={{ background: subjectColor(sj.color) }}
                              >
                                <BookOpen className="h-5 w-5" />
                              </div>
                              {isOfficial ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                                  {T("Oficial")}
                                </span>
                              ) : isPurchased ? (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                                  {purchasedTexts.badge}
                                </span>
                              ) : null}
                            </div>
                            <div>
                              <h3 className="brand-gold-text font-serif text-2xl leading-tight pr-8">
                                {sj.name}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {rootCount} {rootCount === 1 ? t.home.topicsOne : t.home.topicsMany}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {subtopicCount}{" "}
                                {subtopicCount === 1 ? t.home.subtopicsOne : t.home.subtopicsMany}
                              </p>
                            </div>
                          </Card>
                        </Link>
                        <div className="absolute bottom-2 right-2">{handle}</div>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={T("Excluir matéria")}
                            className="absolute top-2 right-2 h-8 w-8 p-0 text-destructive hover:text-destructive"
                            disabled={pendingDelSubjectId === sj.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConfirmDelSubject({ id: sj.id, name: sj.name });
                            }}
                          >
                            {pendingDelSubjectId === sj.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        {!canDelete && isPurchased && (
                          <span
                            className="absolute top-2 right-2 text-muted-foreground"
                            title={purchasedTexts.cannotDelete}
                            aria-label={purchasedTexts.cannotDelete}
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    )}
                  </SortableItem>
                );
              })}
            </SortableList>
          );
        })()}

        {search.trim().length >= 2 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {T("Flashcards")}{" "}
              {searchedCards.isLoading ? "…" : `(${searchedCards.data?.length ?? 0})`}
            </h3>
            {(searchedCards.data ?? []).map((c: any) => (
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
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {c.topics?.subjects?.name} · {c.topics?.name}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <NotificationPrompt />

      <AlertDialog
        open={!!confirmDelSubject}
        onOpenChange={(v) => {
          if (!delSubject.isPending && !v) setConfirmDelSubject(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{T("Excluir esta matéria?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {T(
                "A matéria {name}, todos os seus tópicos e flashcards serão apagados definitivamente. Esta ação não pode ser desfeita.",
                { name: confirmDelSubject?.name ?? "" },
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={delSubject.isPending}>{T("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={delSubject.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelSubject) delSubject.mutate(confirmDelSubject.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {delSubject.isPending ? (
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
    </div>
  );
}

function MissionsCarousel({
  subjects,
  total,
  onReviewAll,
}: {
  subjects: any[];
  total: number;
  onReviewAll: () => void;
}) {
  const dueBySubject = useQuery({
    queryKey: ["due-today", "by-subject"],
    queryFn: async () => {
      const today = todayLocal();
      const map = new Map<string, number>();
      const PAGE = 1000;
      for (let page = 0; page < 50; page++) {
        const { data, error } = await supabase
          .from("flashcards")
          .select("id, topics!inner(review_enabled, subject_id)")
          .eq("topics.review_enabled", true)
          .lte("due_date", today)
          .order("id")
          .range(page * PAGE, page * PAGE + PAGE - 1);
        if (error) throw error;
        (data ?? []).forEach((r: any) => {
          const sid = r.topics?.subject_id;
          if (sid) map.set(sid, (map.get(sid) ?? 0) + 1);
        });
        if (!data || data.length < PAGE) break;
      }
      return Array.from(map.entries());
    },
  });
  const counts = new Map(dueBySubject.data ?? []);
  const items = subjects
    .map((s) => ({ ...s, due: counts.get(s.id) ?? 0 }))
    .filter((s) => s.due > 0)
    .sort((a, b) => b.due - a.due);

  return (
    <section className="rounded-3xl brand-cockpit p-5 sm:p-6 overflow-hidden relative space-y-4">
      <Carousel
        opts={{ align: "start", containScroll: "trimSnaps", slidesToScroll: 1 }}
        aria-label={T("Missões de hoje")}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-70">
              <Sparkles className="h-3 w-3" /> {T("Missões de hoje")}
            </div>
            <h2 className="text-2xl font-serif mt-1">
              {T("Qual matéria você quer revisar hoje?")}
            </h2>
          </div>
          <div className="flex items-center justify-end gap-2">
            <CarouselPrevious className="static h-8 w-8 translate-y-0" />
            <CarouselNext className="static h-8 w-8 translate-y-0" />
            <Button size="sm" variant="secondary" onClick={onReviewAll} className="shrink-0">
              {T("Revisar tudo")} · {total}
            </Button>
          </div>
        </div>
        {dueBySubject.isLoading ? (
          <div className="text-sm opacity-70 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <CarouselContent>
            {items.map((s) => (
              <CarouselItem
                key={s.id}
                className="basis-[82%] sm:basis-[48%] md:basis-[32%] lg:basis-[25%]"
              >
                <Card className="brand-subject-card border-transparent h-full p-4 flex flex-col gap-3">
                  <Link
                    to="/subjects/$subjectId"
                    params={{ subjectId: s.id }}
                    className="flex items-center gap-3 min-w-0"
                    title={`${s.name} · ${T("{n} para revisar", { n: String(s.due) })}`}
                  >
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0"
                      style={{ background: subjectColor(s.color) }}
                    >
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {T("{n} para revisar", { n: String(s.due) })}
                      </p>
                    </div>
                  </Link>
                  <Link to="/study" search={{ subject: s.id } as any} className="self-end">
                    <Button
                      size="sm"
                      className="brand-gold-btn h-7 px-3 text-xs transition-all duration-150 hover:shadow-[0_8px_20px_-6px_color-mix(in_oklab,var(--brand-gold)_75%,transparent)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 active:shadow-sm"
                    >
                      <Rocket className="h-3 w-3 mr-1" /> {T("Revisar")}
                    </Button>
                  </Link>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
        )}
      </Carousel>
    </section>
  );
}

function ReviewTodayCard({
  count,
  onStart,
  onReviewAll,
}: {
  count: number;
  onStart: () => void;
  onReviewAll: () => void;
}) {
  const t = useT();
  return (
    <div className="rounded-3xl brand-cockpit p-6 sm:p-8 overflow-hidden relative">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent/30 blur-3xl" />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-70">
            <Sparkles className="h-3 w-3" /> {t.home.reviewTag}
          </div>
          <h2 className="text-3xl font-serif mt-2">
            {count === 0 ? t.home.reviewNone : t.home.reviewSome(count)}
          </h2>
          <p className="text-sm opacity-70 mt-1 max-w-md">
            {count === 0 ? t.home.reviewNoneHint : t.home.reviewSomeHint}
          </p>
        </div>
        {count > 0 ? (
          <Button size="lg" onClick={onStart} className="shrink-0 brand-gold-btn">
            {t.home.start}
          </Button>
        ) : (
          <Button size="lg" onClick={onReviewAll} className="shrink-0 brand-gold-btn">
            {t.home.reviewNow}
          </Button>
        )}
      </div>
    </div>
  );
}

function MissingAnswersSection({ cards, isLoading }: { cards: any[]; isLoading: boolean }) {
  const t = useT();
  if (isLoading)
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      </Card>
    );
  if (cards.length === 0) return null;
  return (
    <Card className="p-5 space-y-3 border-dashed border-border">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">{t.home.missingAnswerTitle}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {t.home.missingAnswerCount(cards.length)}
        </span>
      </div>
      <ul className="space-y-2">
        {cards.map((c) => (
          <li key={c.id}>
            <Link
              to="/topics/$topicId"
              params={{ topicId: c.topic_id }}
              search={{ edit: c.id }}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 hover:bg-secondary/60 transition"
            >
              <span className="text-sm truncate">{c.question}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                {c.topics?.name ?? ""}
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-card/40">
      <BookOpen className="h-10 w-10 mx-auto text-muted-foreground" />
      <h3 className="mt-4 font-serif text-xl">{t.home.emptyTitle}</h3>
      <p className="text-sm text-muted-foreground mt-1">{t.home.emptyHint}</p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus className="h-4 w-4 mr-1" />
        {t.home.newSubject}
      </Button>
    </div>
  );
}

function NotificationPrompt() {
  const t = useT();
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    setDismissed(localStorage.getItem("notif-dismissed") === "1");
  }, []);

  if (permission !== "default" || dismissed) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex items-start gap-3">
      <div className="h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
        <Bell className="h-5 w-5 text-accent" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium">{t.home.notifTitle}</h4>
        <p className="text-sm text-muted-foreground">{t.home.notifBody}</p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={async () => {
              const p = await Notification.requestPermission();
              setPermission(p);
              if (p === "granted") toast.success(t.home.notifEnabled);
            }}
          >
            {t.home.enable}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              localStorage.setItem("notif-dismissed", "1");
              setDismissed(true);
            }}
          >
            {t.home.later}
          </Button>
        </div>
      </div>
    </div>
  );
}
