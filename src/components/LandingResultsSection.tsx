import { useState, useEffect, useRef } from "react";
import {
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Loader2,
  Clapperboard,
  FileText,
  Network,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { T } from "@/lib/i18n-ui";
import { splitCardQuestionOptions } from "@/lib/card-format";
import type { GeneratedVisitorCard } from "@/lib/landing-visitor.functions";
import type { LandingVisitorMaterial } from "@/lib/landing-visitor-materials.functions";
import { renderMindMapPng, type MindMapTree } from "@/lib/mindmap-render";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";
import { useCardFontSize } from "@/hooks/useCardFontSize";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlashPilotTv } from "@/components/FlashPilotTv";

export type LandingResultsStatus =
  "idle" | "generating" | "identifying" | "ready" | "error" | "limit";

interface LandingResultsSectionProps {
  status: LandingResultsStatus;
  cards: GeneratedVisitorCard[];
  autoMaterials?: { note: boolean; map: boolean; video: boolean };
  onClaim: (name: string, email: string) => Promise<boolean>;
  isClaiming: boolean;
  claimError: string | null;
  emailLocked: boolean;
  knownVisitor?: boolean;
  testCounter?: string | null;
  onReset: () => void;
  onGenerateMaterial: (
    kind: LandingVisitorMaterial["kind"],
    card: GeneratedVisitorCard,
  ) => Promise<LandingVisitorMaterial>;
}

function NotePreview({ text }: { text: string }) {
  return (
    <article className="space-y-5">
      {text.split(/\n{2,}/).map((block, index) => {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const heading =
          lines[0] && !lines[0].startsWith("- ") && !/[.!?]$/.test(lines[0]) ? lines[0] : "";
        const bullets = lines.filter((line) => line.startsWith("- "));
        const paragraphs = lines.filter((line) => !line.startsWith("- ") && line !== heading);
        return (
          <section key={index} className="space-y-2">
            {heading && <h3 className="font-semibold text-foreground">{heading}</h3>}
            {paragraphs.map((line, paragraphIndex) => (
              <p key={paragraphIndex} className="text-sm leading-7 text-muted-foreground">
                {line}
              </p>
            ))}
            {bullets.length > 0 && (
              <ul className="list-disc space-y-2 ps-5 text-sm leading-7 text-muted-foreground">
                {bullets.map((bullet, bulletIndex) => (
                  <li key={bulletIndex}>{bullet.slice(2)}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </article>
  );
}

function MindMapImagePreview({ tree }: { tree: MindMapTree }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    setImageUrl(null);
    setRenderError(false);

    void renderMindMapPng(tree)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      })
      .catch(() => {
        if (active) setRenderError(true);
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [tree]);

  if (renderError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {T("Ocorreu um erro ao processar o seu material. Por favor, tente novamente.")}
      </p>
    );
  }

  if (!imageUrl) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin" />
        {T("Criando…")}
      </div>
    );
  }

  return <ImageZoomViewer src={imageUrl} title={tree.title} height="min(64dvh, 64vh)" />;
}

function FontSizeControls({
  changeFontSize,
  variant = "light",
}: {
  changeFontSize: (delta: number) => void;
  variant?: "light" | "dark";
}) {
  const buttonClass =
    variant === "dark"
      ? "rounded-full px-1.5 text-[11px] font-semibold text-card-back-foreground hover:bg-primary-foreground/15"
      : "rounded-full px-1.5 text-[11px] text-muted-foreground hover:bg-muted";

  return (
    <div
      role="group"
      aria-label={T("Controles do flashcard")}
      className="flex shrink-0 items-center gap-0.5"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => changeFontSize(-2)}
        className={buttonClass}
        aria-label={T("Diminuir fonte")}
      >
        A−
      </button>
      <button
        type="button"
        onClick={() => changeFontSize(2)}
        className={buttonClass}
        aria-label={T("Aumentar fonte")}
      >
        A+
      </button>
    </div>
  );
}

export function LandingResultsSection({
  status,
  cards,
  autoMaterials,
  onClaim,
  isClaiming,
  claimError,
  emailLocked,
  knownVisitor = false,
  testCounter = null,
  onReset,
  onGenerateMaterial,
}: LandingResultsSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [queuedSubmit, setQueuedSubmit] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [materialKind, setMaterialKind] = useState<LandingVisitorMaterial["kind"] | null>(null);
  const [materialResult, setMaterialResult] = useState<LandingVisitorMaterial | null>(null);
  const [materialCache, setMaterialCache] = useState<Record<string, LandingVisitorMaterial>>({});
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [videoAudioUrl, setVideoAudioUrl] = useState<string | null>(null);
  const [materialBusy, setMaterialBusy] = useState<Record<string, string>>({});
  const { fontSize, changeFontSize } = useCardFontSize();

  // Reset flip when switching cards
  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  useEffect(() => {
    setMaterialCache({});
    setMaterialResult(null);
    setMaterialError(null);
    setMaterialDialogOpen(false);
  }, [cards]);

  // Checked attachments are prepared in the background for every card, one card at
  // a time, starting from the card on screen. Each item is retried once; a failure
  // leaves the card-back button available for a manual retry.
  const wantNote = autoMaterials?.note === true;
  const wantMap = autoMaterials?.map === true;
  const wantVideo = autoMaterials?.video === true;
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
  useEffect(() => {
    const kinds: LandingVisitorMaterial["kind"][] = [];
    if (wantNote) kinds.push("note");
    if (wantMap) kinds.push("map");
    if (wantVideo) kinds.push("video");
    setMaterialBusy({});
    if (!kinds.length || !cards.length) return;
    let cancelled = false;
    const order = cards
      .map((_, index) => index)
      .sort(
        (a, b) =>
          Math.abs(a - currentIndexRef.current) - Math.abs(b - currentIndexRef.current) || a - b,
      );
    setMaterialBusy(
      Object.fromEntries(order.flatMap((i) => kinds.map((kind) => [`${i}:${kind}`, "loading"]))),
    );
    void (async () => {
      for (const index of order) {
        const card = cards[index]!;
        await Promise.all(
          kinds.map(async (kind) => {
            const key = `${index}:${kind}`;
            for (let attempt = 0; attempt < 2 && !cancelled; attempt++) {
              try {
                const result = await onGenerateMaterial(kind, card);
                if (cancelled) return;
                setMaterialCache((current) => ({ ...current, [key]: result }));
                setMaterialBusy((current) => {
                  const { [key]: _done, ...rest } = current;
                  return rest;
                });
                return;
              } catch (error) {
                console.error(`Landing ${kind} preparation failed (card ${index + 1})`, error);
              }
            }
            if (!cancelled) setMaterialBusy((current) => ({ ...current, [key]: "failed" }));
          }),
        );
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, wantNote, wantMap, wantVideo]);

  const activeCard = cards[currentIndex] ?? null;
  const questionOptions = activeCard ? splitCardQuestionOptions(activeCard.question) : null;
  const answerParts = activeCard?.answer.split(/\n\nReferência:\s*/i) ?? [];
  const answerText = answerParts[0] ?? "";
  const referenceText = answerParts[1] ?? "";
  const materialActions = [
    { Icon: Network, kind: "map" as const, label: T("Criar mapa mental") },
    { Icon: Clapperboard, kind: "video" as const, label: T("Criar microvídeo") },
    { Icon: FileText, kind: "note" as const, label: T("Criar anotação") },
  ];

  useEffect(() => {
    if (materialResult?.kind !== "video" || !materialResult.audio) {
      setVideoAudioUrl(null);
      return;
    }
    const bytes = Uint8Array.from(atob(materialResult.audio), (char) => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: materialResult.mime }));
    setVideoAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [materialResult]);

  function requestMaterial(kind: LandingVisitorMaterial["kind"], regenerate = false) {
    if (!activeCard) return;
    const cacheKey = `${currentIndex}:${kind}`;
    setMaterialKind(kind);
    setMaterialError(null);
    setMaterialDialogOpen(true);
    const cached = materialCache[cacheKey];
    if (cached && !regenerate) {
      setMaterialResult(cached);
      return;
    }
    setMaterialResult(null);
    setMaterialLoading(true);
    void onGenerateMaterial(kind, activeCard)
      .then((result) => {
        setMaterialCache((current) => ({ ...current, [cacheKey]: result }));
        setMaterialResult(result);
      })
      .catch((error: unknown) =>
        setMaterialError(
          error instanceof Error
            ? error.message
            : T("Ocorreu um erro ao processar o seu material. Por favor, tente novamente."),
        ),
      )
      .finally(() => setMaterialLoading(false));
  }

  const identificationForm = (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-4 shadow-xl sm:p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold sm:text-3xl">{T("Visualizar meus flashcards")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {T("Seus dados são protegidos e usados para vincular seu teste gratuito.")}
        </p>
      </div>

      <form onSubmit={handleSubmitIdentification} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">{T("Seu nome")}</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={T("Como gostaria de ser chamado")}
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">{T("Seu e-mail")}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={emailLocked}
            placeholder="exemplo@email.com"
            className="mt-1.5 h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {(localError || claimError) && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {localError || claimError}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isClaiming || queuedSubmit}
          className="w-full text-base font-semibold"
        >
          {isClaiming || queuedSubmit ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {T("Salvando…")}
            </>
          ) : (
            <>
              <Lock className="mr-2 h-4 w-4" />
              {T("Visualizar meus flashcards")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {T("Seus dados são protegidos e usados para vincular seu teste gratuito.")}
        </p>
      </form>
    </div>
  );

  async function submitIdentification() {
    const success = await onClaim(name.trim(), email.trim());
    if (success) {
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  }

  useEffect(() => {
    if (queuedSubmit && status === "identifying") {
      setQueuedSubmit(false);
      void submitIdentification();
    }
    if (queuedSubmit && status === "error") setQueuedSubmit(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedSubmit, status]);

  async function handleSubmitIdentification(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!name.trim()) {
      setLocalError(T("Por favor, informe seu nome."));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLocalError(T("Por favor, informe um e-mail válido."));
      return;
    }

    if (status === "generating") {
      setQueuedSubmit(true);
      return;
    }
    await submitIdentification();
  }

  if (status === "idle") {
    return <div id="results-section" aria-hidden="true" />;
  }

  return (
    <section id="results-section" className="border-y border-border bg-secondary/50 scroll-mt-6">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
        {(status === "generating" || status === "identifying") && (
          <div className="space-y-8">
            <div className="mx-auto flex max-w-2xl flex-col items-center justify-center pt-2 text-center">
              <div className="relative mb-8 flex h-28 w-28 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary" />
                <div className="absolute inset-3 animate-pulse rounded-full bg-primary/10" />
                <Sparkles className="relative h-10 w-10 animate-bounce text-primary" />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {status === "generating"
                  ? T("Criando seus flashcards com inteligência artificial...")
                  : T("Preparando…")}
              </h2>
              {status === "generating" && (
                <p className="mt-3 max-w-md text-base text-muted-foreground">
                  {T(
                    "Nosso modelo está lendo o conteúdo e estruturando perguntas e respostas atômicas com revisão espaçada.",
                  )}
                </p>
              )}

              {status === "generating" && (
                <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block h-2 w-2 animate-ping rounded-full bg-primary" />
                  {T("Processando material · aguarde alguns segundos")}
                </div>
              )}
            </div>
          </div>
        )}

        {status === "limit" && (
          <div className="mx-auto max-w-xl rounded-2xl border border-primary/30 bg-card p-6 text-center shadow-lg sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold sm:text-2xl text-foreground">
              {T("Você aproveitou todos os seus testes gratuitos de hoje")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {T(
                "Crie sua conta gratuita ou torne-se assinante para continuar gerando flashcards sem limites diários. Confirme o link que enviaremos para o seu e-mail para ativar o acesso.",
              )}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="/auth">{T("Criar minha conta")}</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/pricing">{T("Ver planos de assinatura")}</a>
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-4" onClick={onReset}>
              {T("Voltar ao início")}
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="mx-auto max-w-xl rounded-2xl border border-destructive/30 bg-card p-6 text-center shadow-lg sm:p-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold sm:text-2xl text-foreground">
              {T("Não foi possível gerar os flashcards")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {claimError ||
                T("Ocorreu um erro ao processar o seu material. Por favor, tente novamente.")}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={onReset} variant="outline" size="sm">
                <RefreshCw className="mr-1.5 h-4 w-4" />
                {T("Tentar novamente")}
              </Button>
            </div>
          </div>
        )}

        {status === "ready" && activeCard && (
          <div className="mx-auto w-full min-w-0 max-w-2xl">
            {/* Topo do carrossel */}
            <div className="mb-4 flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {T("Resultado do seu teste")}
                </span>
                <h2 className="break-words text-xl font-bold leading-tight sm:text-3xl">
                  {T("Seus Flashcards Gerados")}
                </h2>
                {materialLoading && (
                  <p
                    role="status"
                    className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Loader2 className="size-4 animate-spin" />
                    {T("Criando…")}
                  </p>
                )}
              </div>
              <div className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground sm:px-3.5 sm:text-xs">
                {T("Card {current} de {total}", { current: currentIndex + 1, total: cards.length })}
              </div>
            </div>

            {/* Cartão com efeito de virar */}
            <div
              role="button"
              tabIndex={0}
              aria-label={T("Virar flashcard")}
              onClick={() => setIsFlipped((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIsFlipped((prev) => !prev);
                }
              }}
              className="group w-full min-w-0 cursor-pointer [perspective:1200px]"
            >
              <div
                className="relative min-h-[395px] w-full transition-transform duration-700 ease-in-out [transform-style:preserve-3d]"
                style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                <div className="absolute inset-0 flex min-h-[395px] flex-col rounded-3xl border border-border bg-card p-4 text-card-foreground text-left shadow-xl [backface-visibility:hidden] [&_*]:!text-left sm:p-6 md:p-8">
                  <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
                    <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                      {T("Pergunta")}
                    </span>
                    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                      <FontSizeControls changeFontSize={changeFontSize} />
                      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground sm:gap-2">
                        <RotateCcw className="h-4 w-4 transition-transform duration-700 group-hover:rotate-180" />
                        <span className="hidden sm:inline">{T("Clique para virar")}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto py-5 text-left sm:py-6">
                    <div className="my-auto w-full shrink-0">
                      {questionOptions ? (
                        <>
                          {questionOptions.prompt && (
                            <p
                              className="mb-4 break-words whitespace-pre-line text-left font-semibold leading-relaxed"
                              style={{ fontSize, lineHeight: 1.35 }}
                            >
                              {questionOptions.prompt}
                            </p>
                          )}
                          <ul
                            className="space-y-2 break-words text-left font-semibold leading-relaxed"
                            style={{ fontSize, lineHeight: 1.35 }}
                          >
                            {questionOptions.options.map((option, index) => (
                              <li
                                key={`${option}-${index}`}
                                className="break-words whitespace-pre-wrap"
                              >
                                {option}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <p
                          className="break-words whitespace-pre-line text-left font-semibold leading-relaxed"
                          style={{ fontSize, lineHeight: 1.35 }}
                        >
                          {activeCard.question}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-border pt-4 text-left text-xs text-muted-foreground">
                    {T("Clique no cartão para conferir a resposta")}
                  </div>
                </div>

                <div
                  className="absolute inset-0 flex min-h-[395px] flex-col rounded-3xl border border-primary-foreground/15 bg-card-back p-4 text-card-back-foreground text-left shadow-xl [backface-visibility:hidden] [&_*]:!text-left sm:p-6 md:p-8"
                  style={{ transform: "rotateY(180deg)" }}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-primary-foreground/20 pb-4">
                    <span className="shrink-0 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                      {T("Resposta")}
                    </span>
                    <div
                      className="flex min-w-0 items-center gap-0.5 sm:gap-1"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <FontSizeControls changeFontSize={changeFontSize} variant="dark" />
                      {materialActions.map(({ Icon, kind, label }) => (
                        <Button
                          key={kind}
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="relative h-8 w-8 shrink-0 text-card-back-foreground hover:bg-primary-foreground/15 hover:text-card-back-foreground sm:h-9 sm:w-9"
                          aria-label={label}
                          title={label}
                          onClick={() => requestMaterial(kind)}
                        >
                          <Icon
                            className={`h-4 w-4 ${
                              materialBusy[`${currentIndex}:${kind}`] === "loading"
                                ? "animate-pulse"
                                : ""
                            } ${materialBusy[`${currentIndex}:${kind}`] === "failed" ? "opacity-50" : ""}`}
                          />
                          {materialCache[`${currentIndex}:${kind}`] && (
                            <span
                              aria-hidden="true"
                              className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400"
                            />
                          )}
                        </Button>
                      ))}
                      <span className="ml-0 flex shrink-0 items-center gap-1 whitespace-nowrap text-xs opacity-80 sm:ml-1 sm:gap-2">
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden sm:inline">{T("Clique para virar")}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto py-4 text-left sm:py-5">
                    <div className="my-auto w-full shrink-0">
                      <p
                        className="break-words whitespace-pre-line text-left font-medium leading-relaxed"
                        style={{ fontSize, lineHeight: 1.35 }}
                      >
                        {answerText}
                      </p>
                      {referenceText && (
                        <p
                          className="mt-5 w-full break-words border-t border-primary-foreground/20                         pt-4 text-left leading-relaxed opacity-85"
                          style={{
                            fontSize: `calc(${typeof fontSize === "number" ? `${fontSize}px` : fontSize} * 0.85)`,
                          }}
                        >
                          <span className="font-semibold">{T("Referência")}: </span>
                          {referenceText}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border-t border-primary-foreground/20 pt-4 text-left text-xs opacity-75">
                    {T("Clique novamente para ver a pergunta")}
                  </div>
                </div>
              </div>
            </div>

            {/* Controles de Navegação do Carrossel */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-x-2 gap-y-3 sm:gap-4">
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                {T("Anterior")}
              </Button>

              {/* Indicadores de bolinhas */}
              <div className="order-3 flex basis-full justify-center gap-1.5 sm:order-none sm:basis-auto">
                {cards.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-label={T("Ir para o card {n}", { n: idx + 1 })}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentIndex
                        ? "w-6 bg-primary"
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                    }`}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setCurrentIndex((prev) => Math.min(cards.length - 1, prev + 1))}
                disabled={currentIndex === cards.length - 1}
              >
                {T("Próximo")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>

            {/* Ações pós-teste */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-border/60 pt-6">
              <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={onReset}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                {T("Novo Teste")}
                {testCounter ? ` · ${testCounter}` : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
      <Dialog
        open={(status === "generating" || status === "identifying") && !knownVisitor}
        onOpenChange={() => undefined}
      >
        <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{T("Visualizar meus flashcards")}</DialogTitle>
          </DialogHeader>
          {identificationForm}
        </DialogContent>
      </Dialog>
      <Dialog
        open={materialDialogOpen}
        onOpenChange={(open) => {
          if (open || !materialLoading) setMaterialDialogOpen(open);
        }}
      >
        <DialogContent
          className={`max-h-[85vh] overflow-y-auto ${
            materialKind === "map" ? "sm:max-w-5xl" : "sm:max-w-2xl"
          }`}
        >
          <DialogHeader>
            <DialogTitle>
              {materialKind === "note"
                ? T("Criar anotação")
                : materialKind === "map"
                  ? T("Gerar mapa mental")
                  : T("Criar microvídeo")}
            </DialogTitle>
          </DialogHeader>
          {materialLoading && (
            <div role="status" className="flex items-center gap-3 rounded-xl bg-muted p-5">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {materialKind === "note"
                  ? T("O PilotAI está escrevendo a anotação a partir do card…")
                  : T("Criando…")}
              </p>
            </div>
          )}
          {materialError && (
            <div role="alert" className="space-y-3 rounded-xl bg-destructive/10 p-4 text-sm">
              <p className="text-destructive">{materialError}</p>
              <Button
                type="button"
                variant="outline"
                disabled={materialLoading || !materialKind}
                onClick={() => materialKind && requestMaterial(materialKind, true)}
              >
                <RefreshCw className="me-2 size-4" />
                {T("Tentar novamente")}
              </Button>
            </div>
          )}
          {materialResult?.kind === "note" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5">
              <h3 className="text-xl font-semibold">{materialResult.title}</h3>
              <NotePreview text={materialResult.text} />
            </div>
          )}
          {materialResult?.kind === "map" && <MindMapImagePreview tree={materialResult.tree} />}
          {materialResult?.kind === "video" && (
            <div className="relative h-[min(65vh,480px)] min-h-[360px] overflow-hidden rounded-3xl">
              <FlashPilotTv
                key={videoAudioUrl ?? "browser-voice"}
                source={{
                  kind: "preview",
                  audioUrl: videoAudioUrl,
                  scenes: materialResult.scenes,
                  lang: materialResult.lang,
                  style: materialResult.style,
                  transcript: materialResult.scenes.map((scene) => scene.speech).join("\n\n"),
                  transcriptNote: null,
                }}
                onClose={() => setMaterialDialogOpen(false)}
              />
            </div>
          )}
          {materialResult && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => materialKind && requestMaterial(materialKind, true)}
            >
              <Sparkles className="me-2 size-4" />
              {T("Gerar novamente")}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
