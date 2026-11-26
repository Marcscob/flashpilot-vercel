import { useEffect, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { cn } from "@/lib/utils";
import { useT, useLang } from "@/lib/i18n";
import {
  Pencil,
  Check,
  X,
  Eraser,
  Play,
  Pause,
  Image as ImageIcon,
  Video,
  FileText,
  MessagesSquare,
  Languages,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { translateCardText } from "@/lib/translate-text.functions";

function cyrb53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
import { MicButton } from "@/components/MicButton";
import { useStudyT } from "@/lib/i18n-audit";
import { SpeakButton } from "@/components/SpeakButton";
import {
  getAutoPlay,
  getRate,
  setAutoPlay,
  setRate,
  speak,
  stopSpeaking,
  ttsSupported,
} from "@/lib/tts";
import { NoteViewerDialog } from "@/components/NoteViewerDialog";
import { MindMapViewerDialog } from "@/components/MindMapViewerDialog";
import { CardMaterialsMenu } from "@/components/CardMaterialsMenu";
import { FlashPilotTv, type TvSource } from "@/components/FlashPilotTv";
import { CreateCardVideoDialog } from "@/components/CreateCardVideoDialog";
import { CreateCardNoteDialog, cardMirrorCategory } from "@/components/CreateCardNoteDialog";
import { GenerateMindMapDialog } from "@/components/GenerateMindMapDialog";
import { supabase } from "@/integrations/supabase/client";
import { normalizeScenes, type TvStyle } from "@/lib/card-video";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ImagePilotCard, type ImagePilotPin } from "@/components/ImagePilotCard";
import { hasHtmlTags, sanitizeCardHtml, stripHtmlTags } from "@/lib/card-html";
import { useCardFontSize } from "@/hooks/useCardFontSize";

type Props = {
  cardId?: string;
  isOfficial?: boolean;
  subjectLang?: string | null;
  question: string;
  answer: string;
  userAnswer?: string | null;
  linkedNote?: { id: string; title: string } | null;
  mindMapPath?: string | null;
  videoUrls?: (string | null | undefined)[];
  cardFormat?: string | null;
  topicLabel?: string | null;
  /** Idioma efetivo do card (Fase 2). Ausente/null = narração padrão de hoje. */
  lang?: string | null;
  className?: string;
  reviewed?: boolean;
  /** ImagePilot: imagem numerada na frente do card. */
  imagePilotPath?: string | null;
  imagePilotPins?: ImagePilotPin[] | null;
  imagePilotFocus?: number | null;
  onToggleReviewed?: (next: boolean) => Promise<void> | void;
  onSave?: (patch: { question: string; answer: string }) => Promise<void> | void;
  onSaveUserAnswer?: (userAnswer: string) => Promise<void> | void;
};

const SPEECH_RATES = [0.75, 1, 1.25, 1.5];

export function FlipCard({
  cardId,
  isOfficial,
  subjectLang,
  question,
  answer,
  userAnswer,
  linkedNote,
  mindMapPath,
  videoUrls,
  cardFormat,
  topicLabel,
  lang,
  className,
  reviewed,
  imagePilotPath,
  imagePilotPins,
  imagePilotFocus,
  onToggleReviewed,
  onSave,
  onSaveUserAnswer,
}: Props) {
  const s0 = useStudyT();
  const isStructured = cardFormat === "mcq" || cardFormat === "cloze";
  const isImagePilot = cardFormat === "imagepilot" && !!imagePilotPath;
  const videos = (videoUrls ?? []).filter((v): v is string => !!v && v.trim() !== "");

  const [flipped, setFlipped] = useState(false);
  const [editingFront, setEditingFront] = useState(false);
  const [editingBack, setEditingBack] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [mindMapOpen, setMindMapOpen] = useState(false);
  const { lang: appLang } = useLang();
  const [tvList, setTvList] = useState<Extract<TvSource, { kind: "generated" }>[]>([]);
  const [tv, setTv] = useState<TvSource | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [note, setNote] = useState(linkedNote ?? null);
  const [mapPath, setMapPath] = useState(mindMapPath ?? null);
  useEffect(() => {
    setNote(linkedNote ?? null);
    setMapPath(mindMapPath ?? null);
  }, [cardId, linkedNote?.id, mindMapPath]);
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [mapCreateOpen, setMapCreateOpen] = useState(false);
  const [mapCat, setMapCat] = useState<string | null>(null);
  // Bumped every time a material (microvídeo, mapa ou anotação) becomes ready.
  const [materialsPulse, setMaterialsPulse] = useState(0);
  const pulseMaterials = () => setMaterialsPulse((n) => n + 1);
  // Official content is read-only; ImagePilot cards use image_url for their own image.
  const canAttach = !!cardId && !isOfficial && !isImagePilot;
  const loadTv = async (playId?: string) => {
    if (!cardId) return;
    const { data } = await supabase
      .from("card_videos")
      .select("id, scenes, lang, style, transcript, transcript_note")
      .eq("card_id", cardId)
      .order("created_at", { ascending: false });
    const list = (data ?? []).map((r) => ({
      kind: "generated" as const,
      id: r.id,
      scenes: normalizeScenes({ scenes: r.scenes }),
      lang: r.lang,
      style: r.style as TvStyle,
      transcript: r.transcript,
      transcriptNote: r.transcript_note,
    }));
    setTvList(list);
    if (playId) {
      const v = list.find((x) => x.id === playId);
      if (v) {
        setFlipped(true);
        setTv(v);
      }
    }
  };
  useEffect(() => {
    setTv(null);
    void loadTv();
  }, [cardId]);

  const [q, setQ] = useState(question);
  const [a, setA] = useState(answer);
  const [ua, setUa] = useState(userAnswer ?? "");
  const [savingUa, setSavingUa] = useState(false);
  const [savingReviewed, setSavingReviewed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoPlay, setAutoPlayState] = useState(false);
  const { fontSize, changeFontSize } = useCardFontSize();
  const [rate, setRateState] = useState(1);
  const t = useT();

  // Tradução momentânea do texto visível (só ajuda de leitura; nada é gravado).
  const baseLang = (code?: string | null) => (code ?? "").toLowerCase().split(/[-_]/)[0];
  const targetLang = appLang || "pt";
  const canTranslate = !!lang && baseLang(lang) !== baseLang(targetLang);
  const [translation, setTranslation] = useState<{ front?: string; back?: string }>({});
  const [showTranslation, setShowTranslation] = useState<{ front: boolean; back: boolean }>({
    front: false,
    back: false,
  });
  const [translating, setTranslating] = useState(false);

  async function toggleTranslation(face: "front" | "back") {
    if (showTranslation[face]) {
      setShowTranslation((prev) => ({ ...prev, [face]: false }));
      return;
    }
    const cached = translation[face];
    if (cached) {
      setShowTranslation((prev) => ({ ...prev, [face]: true }));
      return;
    }
    const source = stripHtmlTags(face === "front" ? question : answer).trim();
    if (!source) return;
    setTranslating(true);
    const text = source.slice(0, 4000);
    const storeKey = `fp-tr2:${targetLang}:${lang ?? ""}:${text.length}:${cyrb53(text)}`;
    try {
      let translated: string | null = null;
      try {
        translated = localStorage.getItem(storeKey);
      } catch {
        // Storage unavailable (private mode); fall through to the server.
      }
      if (!translated) {
        const res = await translateCardText({
          data: { actionId: crypto.randomUUID(), text, lang: lang ?? undefined, targetLang },
        });
        translated = res.text;
        try {
          localStorage.setItem(storeKey, translated);
        } catch {
          // Quota exceeded; the server cache still covers repeats.
        }
      }
      setTranslation((prev) => ({ ...prev, [face]: translated! }));
      setShowTranslation((prev) => ({ ...prev, [face]: true }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : T("Não consegui traduzir agora."));
    } finally {
      setTranslating(false);
    }
  }

  function translateButton(variant: "light" | "dark", mobile = false) {
    if (!canTranslate) return null;
    const face = variant === "light" ? "front" : "back";
    return (
      <button
        type="button"
        disabled={translating}
        onClick={(e) => {
          e.stopPropagation();
          void toggleTranslation(face);
        }}
        className={cn(
          "rounded-full text-[11px] inline-flex items-center justify-center gap-1 disabled:opacity-50",
          mobile ? "h-8 min-w-8 px-2" : "px-1.5 py-1",
          variant === "dark"
            ? "hover:bg-primary-foreground/15 text-primary-foreground/80"
            : "hover:bg-muted text-muted-foreground",
          showTranslation[face] && variant === "light" && "text-primary",
        )}
        title={T("Traduzir com o PilotAI")}
        aria-label={T("Traduzir com o PilotAI")}
      >
        <Languages className="h-3.5 w-3.5" />
        {translating ? "..." : baseLang(targetLang).toUpperCase()}
      </button>
    );
  }

  useEffect(() => {
    setAutoPlayState(getAutoPlay());
    setRateState(getRate());
  }, []);

  // Velocidade aplicada na reprodução (nunca gera áudio diferente por velocidade).
  function cycleRate() {
    const idx = SPEECH_RATES.findIndex((r) => Math.abs(r - rate) < 0.01);
    const next = SPEECH_RATES[(idx + 1) % SPEECH_RATES.length]!;
    setRateState(next);
    setRate(next);
    stopSpeaking();
  }

  function narrate(rawText: string) {
    return speak(rawText, { lang: lang ?? undefined, rate });
  }

  useEffect(() => {
    setQ(question);
    setA(answer);
    setUa(userAnswer ?? "");
    setEditingFront(false);
    setEditingBack(false);
    setFlipped(false);
    setTranslation({});
    setShowTranslation({ front: false, back: false });
    stopSpeaking();
    if (getAutoPlay() && ttsSupported() && question.trim()) {
      // Slight delay so the card is visible before narration starts
      const id = window.setTimeout(() => narrate(question), 250);
      return () => window.clearTimeout(id);
    }
  }, [question, answer, userAnswer]);

  useEffect(() => {
    if (!ttsSupported()) return;
    if (!getAutoPlay()) return;
    if (editingFront || editingBack) return;
    stopSpeaking();
    const text = flipped ? answer : question;
    if (text.trim()) {
      const id = window.setTimeout(() => narrate(text), 250);
      return () => window.clearTimeout(id);
    }
  }, [flipped]);

  useEffect(() => () => stopSpeaking(), []);

  function toggleAutoPlay() {
    const next = !autoPlay;
    setAutoPlayState(next);
    setAutoPlay(next);
    if (!next) stopSpeaking();
  }

  async function saveFront() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ question: q, answer });
      setEditingFront(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveBack() {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ question, answer: a });
      setEditingBack(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveUserAnswer() {
    if (!onSaveUserAnswer) return;
    setSavingUa(true);
    try {
      await onSaveUserAnswer(ua);
    } finally {
      setSavingUa(false);
    }
  }

  async function toggleReviewed() {
    if (!onToggleReviewed || savingReviewed) return;
    setSavingReviewed(true);
    try {
      await onToggleReviewed(!reviewed);
    } finally {
      setSavingReviewed(false);
    }
  }

  function reviewedToggle(variant: "light" | "dark") {
    if (!onToggleReviewed) return null;
    return (
      <label
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1.5 cursor-pointer select-none rounded-full px-2 py-1 text-[11px]",
          variant === "dark" ? "bg-primary-foreground/15" : "bg-muted",
          savingReviewed && "opacity-60",
        )}
      >
        <input
          type="checkbox"
          checked={!!reviewed}
          disabled={savingReviewed}
          onChange={toggleReviewed}
          className="h-3.5 w-3.5 accent-current cursor-pointer"
        />
        {T("Revisado")}
      </label>
    );
  }

  return (
    <div className={cn("perspective-1000 w-full", className)}>
      <div
        className={cn(
          "relative w-full transition-transform duration-500 ease-out [transform-style:preserve-3d]",
          isImagePilot ? "h-[clamp(460px,82dvh,760px)]" : "h-[clamp(280px,72dvh,420px)]",
        )}
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* FRONT */}
        <div
          className={cn(
            "absolute inset-0 rounded-3xl bg-card border border-border shadow-card p-4 sm:p-8 flex-col gap-3 text-left [backface-visibility:hidden]",
            flipped ? "pointer-events-none" : "flex",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {topicLabel && (
                <span className="inline-block max-w-full whitespace-normal break-words leading-tight rounded-md bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {topicLabel}
                </span>
              )}
            </div>
            <div
              className="hidden max-w-full flex-wrap items-center justify-end gap-1 sm:flex"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => changeFontSize(-2)}
                  className="px-1.5 rounded-full hover:bg-muted text-[11px] text-muted-foreground"
                  aria-label={T("Diminuir fonte")}
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => changeFontSize(2)}
                  className="px-1.5 rounded-full hover:bg-muted text-[13px] text-muted-foreground"
                  aria-label={T("Aumentar fonte")}
                >
                  A+
                </button>
              </div>
              {ttsSupported() && (
                <>
                  <button
                    type="button"
                    onClick={toggleAutoPlay}
                    className={cn(
                      "p-1.5 rounded-full hover:bg-muted",
                      autoPlay ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-label={autoPlay ? s0.autoOff : s0.autoOn}
                    title={autoPlay ? s0.autoOnTitle : s0.autoOffTitle}
                  >
                    {autoPlay ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <SpeakButton
                    text={question}
                    ariaLabel={s0.narrateQuestion}
                    lang={lang}
                    rate={rate}
                  />
                  <button
                    type="button"
                    onClick={cycleRate}
                    className="px-1.5 rounded-full hover:bg-muted text-[11px] text-muted-foreground"
                    aria-label={s0.rateLabel}
                    title={s0.rateTitle(rate)}
                  >
                    {rate}x
                  </button>
                </>
              )}
              {/* Fase 18 — só em cards de idioma estrangeiro; leva a frase para a conversa. */}
              {lang && !lang.startsWith("pt") && (
                <Link
                  to="/language-chat"
                  search={{ practice: question.slice(0, 500), lang }}
                  className="px-1.5 rounded-full hover:bg-muted text-[11px] text-muted-foreground inline-flex items-center gap-1"
                  title={T("Praticar esta frase na conversação")}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessagesSquare className="h-3.5 w-3.5" /> {T("Praticar")}
                </Link>
              )}
              {translateButton("light")}
              {onSave && !editingFront && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFront(true);
                    setQ(question);
                  }}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                  aria-label={T("Editar")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {editingFront ? (
            <>
              <div className="relative flex-1 min-h-0">
                <textarea
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full h-full resize-none rounded-xl border border-border bg-background p-3 pr-14 text-lg font-serif leading-snug focus:outline-none focus:ring-2 focus:ring-primary/40 overflow-y-auto"
                  autoFocus
                />
                <MicButton value={q} onChange={setQ} className="absolute right-2 bottom-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingFront(false);
                    setQ(question);
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs bg-muted text-foreground"
                >
                  <X className="h-3 w-3" /> {t.common.cancel}
                </button>
                <button
                  type="button"
                  disabled={saving || !q.trim()}
                  onClick={saveFront}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> {t.common.save}
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => setFlipped(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setFlipped(true);
                }}
                className="min-h-0 flex-1 w-full overflow-y-auto overscroll-contain touch-pan-y text-left [&_*]:!text-left cursor-pointer [-webkit-overflow-scrolling:touch]"
                aria-label={t.study.cardFront}
              >
                {hasHtmlTags(question) ? (
                  <p
                    className="font-serif leading-snug text-foreground whitespace-pre-wrap"
                    style={{ fontSize: fontSize, lineHeight: 1.35 }}
                    dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(question) }}
                  />
                ) : (
                  <p
                    className="font-serif leading-snug text-foreground whitespace-pre-wrap"
                    style={{ fontSize: fontSize, lineHeight: 1.35 }}
                  >
                    {question}
                  </p>
                )}
                {isImagePilot && (
                  <ImagePilotCard
                    imagePath={imagePilotPath!}
                    pins={imagePilotPins ?? []}
                    focus={imagePilotFocus}
                    face="front"
                    className="mt-3"
                  />
                )}
                {showTranslation.front && translation.front && (
                  <p
                    className="mt-3 border-t border-border pt-2 font-serif italic leading-snug text-muted-foreground whitespace-pre-wrap"
                    style={{ fontSize: Math.max(12, fontSize - 4), lineHeight: 1.35 }}
                  >
                    {translation.front}
                  </p>
                )}
              </div>

              <div
                className="flex items-center gap-1 border-t border-border pt-1 sm:hidden"
                onClick={(e) => e.stopPropagation()}
                aria-label={T("Controles do flashcard")}
              >
                <button
                  type="button"
                  onClick={() => changeFontSize(-2)}
                  className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-muted"
                  aria-label={T("Diminuir fonte")}
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => changeFontSize(2)}
                  className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-base text-muted-foreground hover:bg-muted"
                  aria-label={T("Aumentar fonte")}
                >
                  A+
                </button>
                {ttsSupported() && (
                  <>
                    <button
                      type="button"
                      onClick={toggleAutoPlay}
                      className={cn(
                        "flex h-8 min-w-0 flex-1 items-center justify-center rounded-full hover:bg-muted",
                        autoPlay ? "text-primary" : "text-muted-foreground",
                      )}
                      aria-label={autoPlay ? s0.autoOff : s0.autoOn}
                      title={autoPlay ? s0.autoOnTitle : s0.autoOffTitle}
                    >
                      {autoPlay ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <SpeakButton
                      text={question}
                      ariaLabel={s0.narrateQuestion}
                      lang={lang}
                      rate={rate}
                      className="flex h-8 min-w-0 flex-1 items-center justify-center p-0"
                    />
                    <button
                      type="button"
                      onClick={cycleRate}
                      className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-sm text-muted-foreground hover:bg-muted"
                      aria-label={s0.rateLabel}
                      title={s0.rateTitle(rate)}
                    >
                      {rate}x
                    </button>
                  </>
                )}
                {lang && !lang.startsWith("pt") && (
                  <Link
                    to="/language-chat"
                    search={{ practice: question.slice(0, 500), lang }}
                    className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    title={T("Praticar esta frase na conversação")}
                    aria-label={T("Praticar esta frase na conversação")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessagesSquare className="h-5 w-5" />
                  </Link>
                )}
                {translateButton("light", true)}
                {onSave && !editingFront && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFront(true);
                      setQ(question);
                    }}
                    className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    aria-label={T("Editar pergunta")}
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{t.study.cardFrontHint}</span>
                {reviewedToggle("light")}
              </div>
            </>
          )}
        </div>

        {/* BACK */}
        <div
          className={cn(
            "absolute inset-0 rounded-3xl bg-card-back text-card-back-foreground shadow-card p-4 sm:p-6 flex-col gap-2 [backface-visibility:hidden]",
            flipped ? "flex" : "pointer-events-none",
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
          {tv && flipped && (
            <FlashPilotTv
              source={tv}
              onClose={() => setTv(null)}
              onDeleted={() => {
                setTv(null);
                void loadTv();
              }}
            />
          )}

          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {topicLabel && (
                <span className="inline-block max-w-full whitespace-normal break-words leading-tight rounded-md bg-primary-foreground/15 px-2 py-0.5 text-[10px] uppercase tracking-wide opacity-90">
                  {topicLabel}
                </span>
              )}
            </div>
            <TooltipProvider delayDuration={200}>
              <div
                className="hidden max-w-full flex-wrap items-center justify-end gap-1 sm:flex"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => changeFontSize(-2)}
                    className="px-1.5 rounded-full hover:bg-primary-foreground/15 text-[11px]"
                    aria-label={T("Diminuir fonte")}
                  >
                    A−
                  </button>
                  <button
                    type="button"
                    onClick={() => changeFontSize(2)}
                    className="px-1.5 rounded-full hover:bg-primary-foreground/15 text-[13px]"
                    aria-label={T("Aumentar fonte")}
                  >
                    A+
                  </button>
                </div>
                {ttsSupported() && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <SpeakButton
                          text={answer}
                          variant="dark"
                          ariaLabel={s0.narrateAnswer}
                          lang={lang}
                          rate={rate}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{s0.narrateAnswer}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {translateButton("dark")}
                <CardMaterialsMenu
                  hasNote={!!note}
                  hasMap={!!mapPath}
                  videos={videos}
                  onOpenNote={() => setNoteOpen(true)}
                  onOpenMap={() => setMindMapOpen(true)}
                  onPlayLink={(url) => setTv({ kind: "link", url })}
                  tvVideos={tvList}
                  onPlayTv={(id) => setTv(tvList.find((v) => v.id === id) ?? null)}
                  onCreateVideo={cardId ? () => setCreateOpen(true) : undefined}
                  onCreateNote={canAttach && !note ? () => setNoteCreateOpen(true) : undefined}
                  onCreateMap={
                    canAttach && !mapPath
                      ? () => {
                          void cardMirrorCategory(cardId!).then(setMapCat);
                          setMapCreateOpen(true);
                        }
                      : undefined
                  }
                  pulseKey={materialsPulse}
                />

                {onSave && !editingBack && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingBack(true);
                          setA(answer);
                        }}
                        className="p-1.5 rounded-full hover:bg-primary-foreground/15 text-primary-foreground/80"
                        aria-label={T("Editar")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{T("Editar")}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          </div>

          {editingBack ? (
            <>
              <div className="relative flex-1 min-h-0">
                <textarea
                  value={a}
                  onChange={(e) => setA(e.target.value)}
                  className="w-full h-full resize-none rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 p-3 pr-14 text-lg font-serif leading-snug text-primary-foreground placeholder:text-primary-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary-foreground/40 overflow-y-auto"
                  autoFocus
                />
                <MicButton
                  value={a}
                  onChange={setA}
                  variant="dark"
                  className="absolute right-2 bottom-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBack(false);
                    setA(answer);
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs bg-primary-foreground/15"
                >
                  <X className="h-3 w-3" /> {t.common.cancel}
                </button>
                {a !== "" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t.topic.confirmClearAnswer)) setA("");
                    }}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs bg-destructive/15 text-destructive"
                  >
                    <Eraser className="h-3 w-3" /> {t.topic.clearAnswer}
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving || !a.trim()}
                  onClick={saveBack}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs bg-primary-foreground text-primary disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> {t.common.save}
                </button>
              </div>
            </>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFlipped(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setFlipped(false);
              }}
              className="min-h-0 flex-1 w-full overflow-y-auto overscroll-contain touch-pan-y text-left [&_*]:!text-left cursor-pointer [-webkit-overflow-scrolling:touch]"
              aria-label={t.study.cardBackHint}
            >
              {hasHtmlTags(answer) ? (
                <p
                  className="font-serif leading-snug whitespace-pre-wrap"
                  style={{ fontSize: fontSize, lineHeight: 1.35 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(answer) }}
                />
              ) : (
                <p
                  className="font-serif leading-snug whitespace-pre-wrap"
                  style={{ fontSize: fontSize, lineHeight: 1.35 }}
                >
                  {answer}
                </p>
              )}
              {isImagePilot && (
                <ImagePilotCard
                  imagePath={imagePilotPath!}
                  pins={imagePilotPins ?? []}
                  focus={imagePilotFocus}
                  face="back"
                  className="mt-3"
                />
              )}
              {showTranslation.back && translation.back && (
                <p
                  className="mt-3 border-t border-primary-foreground/25 pt-2 font-serif italic leading-snug text-primary-foreground/80 whitespace-pre-wrap"
                  style={{ fontSize: Math.max(12, fontSize - 4), lineHeight: 1.35 }}
                >
                  {translation.back}
                </p>
              )}
            </div>
          )}

          {/* MINHA RESPOSTA — bloco ocultado até segunda ordem (pedido de Marcelo em 30/10/2026):
              ocupava espaço demais na resposta do card. Para reativar, apague a linha de abertura
              deste comentário e o fechamento logo abaixo do bloco.
          {onSaveUserAnswer && (
            <div
              className="shrink-0 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20 p-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-widest opacity-70">{s0.myAnswer}</span>
                <button
                  type="button"
                  onClick={saveUserAnswer}
                  disabled={savingUa || (ua ?? "") === (userAnswer ?? "")}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] bg-primary-foreground text-primary disabled:opacity-40"
                >
                  <Check className="h-3 w-3" /> {savingUa ? "..." : t.common.save}
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={ua}
                  onChange={(e) => setUa(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={T("Escreva aqui a sua resposta pessoal…")}
                  rows={2}
                  className="w-full resize-none rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 p-1.5 pr-10 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/40"
                />
                <MicButton value={ua} onChange={setUa} variant="dark" className="absolute right-1 bottom-1" />
              </div>
            </div>
          )}
          */}

          {!editingBack && (
            <TooltipProvider delayDuration={200}>
              <div
                className="grid grid-cols-4 gap-2 border-t border-primary-foreground/20 pt-2 sm:hidden"
                onClick={(e) => e.stopPropagation()}
                aria-label={T("Controles do flashcard")}
              >
                <button
                  type="button"
                  onClick={() => changeFontSize(-2)}
                  className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-sm hover:bg-primary-foreground/15"
                  aria-label={T("Diminuir fonte")}
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => changeFontSize(2)}
                  className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-base hover:bg-primary-foreground/15"
                  aria-label={T("Aumentar fonte")}
                >
                  A+
                </button>
                {ttsSupported() && (
                  <>
                    <button
                      type="button"
                      onClick={toggleAutoPlay}
                      className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full hover:bg-primary-foreground/15"
                      aria-label={autoPlay ? s0.autoOff : s0.autoOn}
                      title={autoPlay ? s0.autoOnTitle : s0.autoOffTitle}
                    >
                      {autoPlay ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <SpeakButton
                      text={answer}
                      variant="dark"
                      ariaLabel={s0.narrateAnswer}
                      lang={lang}
                      rate={rate}
                      className="flex h-8 min-w-0 flex-1 items-center justify-center p-0"
                    />
                    <button
                      type="button"
                      onClick={cycleRate}
                      className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-sm hover:bg-primary-foreground/15"
                      aria-label={s0.rateLabel}
                      title={s0.rateTitle(rate)}
                    >
                      {rate}x
                    </button>
                  </>
                )}
                {lang && !lang.startsWith("pt") && (
                  <Link
                    to="/language-chat"
                    search={{ practice: question.slice(0, 500), lang }}
                    className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full hover:bg-primary-foreground/15"
                    title={T("Praticar esta frase na conversação")}
                    aria-label={T("Praticar esta frase na conversação")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessagesSquare className="h-5 w-5" />
                  </Link>
                )}
                {translateButton("dark", true)}
                <CardMaterialsMenu
                  mobile
                  hasNote={!!note}
                  hasMap={!!mapPath}
                  videos={videos}
                  onOpenNote={() => setNoteOpen(true)}
                  onOpenMap={() => setMindMapOpen(true)}
                  onPlayLink={(url) => setTv({ kind: "link", url })}
                  tvVideos={tvList}
                  onPlayTv={(id) => setTv(tvList.find((v) => v.id === id) ?? null)}
                  onCreateVideo={cardId ? () => setCreateOpen(true) : undefined}
                  onCreateNote={canAttach && !note ? () => setNoteCreateOpen(true) : undefined}
                  onCreateMap={
                    canAttach && !mapPath
                      ? () => {
                          void cardMirrorCategory(cardId!).then(setMapCat);
                          setMapCreateOpen(true);
                        }
                      : undefined
                  }
                  pulseKey={materialsPulse}
                />

                {onSave && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBack(true);
                      setA(answer);
                    }}
                    className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-full text-primary-foreground/80 hover:bg-primary-foreground/15"
                    aria-label={T("Editar resposta")}
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                )}
              </div>
            </TooltipProvider>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 text-xs">
            <span className="opacity-70">{t.study.cardBackHint}</span>
            <div className="flex items-center gap-2 min-w-0">{reviewedToggle("dark")}</div>
          </div>
        </div>
      </div>
      {canAttach && (
        <>
          <CreateCardNoteDialog
            open={noteCreateOpen}
            onOpenChange={setNoteCreateOpen}
            cardId={cardId!}
            lang={appLang}
            onSaved={(n) => {
              setNote(n);
              pulseMaterials();
            }}
          />
          <GenerateMindMapDialog
            open={mapCreateOpen}
            onOpenChange={setMapCreateOpen}
            source={{ kind: "cards", cardIds: [cardId!], suggestLang: appLang }}
            fixedCategoryId={mapCat}
            onSaved={async ({ path }) => {
              const { error } = await supabase
                .from("flashcards")
                .update({ image_url: path })
                .eq("id", cardId!);
              if (error) toast.error(error.message);
              else {
                setMapPath(path);
                pulseMaterials();
              }
            }}
          />
        </>
      )}
      {note && <NoteViewerDialog noteId={note.id} open={noteOpen} onOpenChange={setNoteOpen} />}
      {cardId && (
        <CreateCardVideoDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          cardId={cardId}
          isOfficial={!!isOfficial}
          question={question}
          answer={answer}
          appLang={appLang}
          subjectLang={subjectLang ?? lang ?? null}
          onCreated={() => {
            void loadTv();
            pulseMaterials();
          }}
          onReady={(id) => void loadTv(id)}
        />
      )}
      {mapPath && (
        <MindMapViewerDialog path={mapPath} open={mindMapOpen} onOpenChange={setMindMapOpen} />
      )}
    </div>
  );
}
