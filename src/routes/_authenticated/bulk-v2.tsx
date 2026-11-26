import { resolveDestinationNamesFn } from "@/lib/destination-names.functions";
import { automaticCardCounts, generationCostCheck } from "@/lib/auto-card-count";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { T } from "@/lib/i18n-ui";
import { CameraCaptureDialog } from "@/components/CameraCaptureDialog";
import { YouTubeSourceInput } from "@/components/YouTubeSourceInput";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getUiLang } from "@/lib/i18n-ui";
import {
  YOUTUBE_COST_WARN_CHARS,
  YOUTUBE_TRIAL_CHARS,
  languageLabel,
  needsTranslationChoice,
} from "@/lib/youtube-limits";
import { canonicalYoutubeUrl } from "@/lib/youtube-url";
import { parseFlashcardsFromFile } from "@/lib/parse-cards-file.functions";
import { useLang } from "@/lib/i18n";
import { validatedExtLanguage } from "@/lib/languages";
import { getYoutubeTranscript } from "@/lib/youtube.functions";
import { saveFlashcardsAtomically } from "@/lib/flashcards-save.functions";
import { createMatchGameFn } from "@/lib/match-game.functions";
import { FlashMatchOption } from "@/components/FlashMatchOption";
import { createDocumentJob } from "@/lib/bulk-jobs";
import { friendlyAiError } from "@/lib/ai-error-toast";
import { youtubeErrorMessage } from "@/lib/youtube-errors";
import { WebPageSourceInput } from "@/components/WebPageSourceInput";
import { WEB_PAGES_BULK_MAX, parseWebUrls } from "@/lib/web-page-urls";
import { getWebImage, getWebPageText, planWebPages } from "@/lib/web-page.functions";
import { isValidWebPageUrl } from "@/lib/web-page-text";
import { isWebPageError, webPageErrorMessage } from "@/lib/web-page-errors";
import {
  readSheet,
  sheetToCards,
  sheetToText,
  SHEET_MAX_ROWS,
  SHEET_AI_MAX_CHARS,
  type SheetData,
} from "@/lib/sheet-import";
import { downloadSheetTemplateForLanguage } from "@/lib/sheet-templates";
import { readDocumentText } from "@/lib/document-import";
import {
  distributeCards,
  focusSourceRange,
  splitSourceChunks,
  SOURCE_MAX_CHUNKS,
  SOURCE_CHUNK_CHARS,
} from "@/lib/source-chunks";
import { useAiBillingInfo } from "@/hooks/useAiBillingInfo";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const FREE_CARD_LIMIT = 100;
const HARD_USE_CARDS = 20;

const FILE_ACCEPT: Record<string, string> = {
  image: "image/*",
  doc: ".pdf,.docx,.txt",
  audio: "audio/*",
  csv: ".csv,.xlsx,.xls,text/csv",
};
import {
  Camera,
  Image as ImageIcon,
  FileText,
  Layers,
  ListChecks,
  Sparkles,
  Trash2,
  Plus,
  Coins,
  Loader2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  BulkV2Attachments,
  EMPTY_ATTACHMENTS,
  type BulkAttachments,
} from "@/components/BulkV2Attachments";
import { MicButton } from "@/components/MicButton";
import { transcribeAudio } from "@/lib/stt.functions";
import { useBulkV2T } from "@/lib/i18n-bulk-v2";
import { cn } from "@/lib/utils";
import { BulkV2CaptureSelector } from "@/components/BulkV2CaptureSelector";
import { CommerceItemInfo } from "@/components/CommerceItemInfo";
import { ContentMapDialog, type SavedContentTopic } from "@/components/ContentMapDialog";
import { splitLegalText } from "@/lib/legal-hierarchy";
import { nextSourceIndex } from "@/lib/study-source-order";

export const Route = createFileRoute("/_authenticated/bulk-v2")({
  head: () => ({
    meta: [
      { title: "Criação de flashcards · FlashPilot" },
      {
        name: "description",
        content: "Capture conteúdo, escolha o que vira flashcard e revise antes de salvar.",
      },
      { property: "og:title", content: "Criação de flashcards · FlashPilot" },
      {
        property: "og:description",
        content: "Capture conteúdo, escolha o que vira flashcard e revise antes de salvar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BulkV2Page,
});

type Scope = "all" | "topics" | "ai";

type DraftRow = {
  id: number;
  question: string;
  answer: string;
  jobId?: string;
  outputId?: string;
  videoUrl?: string | null;
  destination?: { subject: string; topic: string; subtopic?: string } | null;
};

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

async function handleTemplateDownload(language: string) {
  try {
    await downloadSheetTemplateForLanguage(language);
    return true;
  } catch {
    toast.error(T("Não foi possível gerar a planilha modelo."));
    return false;
  }
}

let nextRowId = 1;

const NEW_VALUE = "__new__";
const SUBJECT_COLORS = [
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

type DestOpt = { id: string; name: string };

function DestinationSelect(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opts: DestOpt[];
  disabled?: boolean;
  selectLabel: string;
  createLabel: string;
  namePlaceholder: string;
  addLabel: string;
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const id = await props.onCreate(n);
    setBusy(false);
    if (id) {
      setName("");
      setCreating(false);
      props.onChange(id);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{props.label}</span>
      {creating ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void confirm();
              }
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder={props.namePlaceholder}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || !name.trim()}
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : props.addLabel}
          </button>
        </div>
      ) : (
        <select
          value={props.value}
          onChange={(e) => {
            if (e.target.value === NEW_VALUE) {
              setCreating(true);
            } else props.onChange(e.target.value);
          }}
          disabled={props.disabled}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
        >
          <option value="">{props.selectLabel}</option>
          {props.opts.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value={NEW_VALUE}>＋ {props.createLabel}</option>
        </select>
      )}
    </div>
  );
}

function BulkV2Page() {
  const t = useBulkV2T();
  const [capture, setCapture] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [quantity, setQuantity] = useState(10);
  const [quantityRaw, setQuantityRaw] = useState("10");
  const [autoQuantity, setAutoQuantity] = useState(false);
  const [instructions, setInstructions] = useState("");
  const instructionsRef = useRef<HTMLTextAreaElement>(null);
  const [instrBlink, setInstrBlink] = useState(false);
  const blinkTimerRef = useRef<number | null>(null);
  // Pisca o rótulo 2x (vermelho <-> padrão em ~1,2s) e foca a caixa de instruções.
  function blinkInstructions() {
    if (blinkTimerRef.current) window.clearInterval(blinkTimerRef.current);
    instructionsRef.current?.focus();
    let n = 0;
    setInstrBlink(true);
    blinkTimerRef.current = window.setInterval(() => {
      n += 1;
      if (n >= 12) {
        if (blinkTimerRef.current) window.clearInterval(blinkTimerRef.current);
        blinkTimerRef.current = null;
        setInstrBlink(false);
        return;
      }
      setInstrBlink(n % 2 === 0);
    }, 300);
  }
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [savedContent, setSavedContent] = useState<SavedContentTopic[]>([]);
  const [text, setText] = useState("");
  const [youtube, setYoutube] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  // Keep each input's filter stable: the picker opens during the source click,
  // before React has committed the new capture state.
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attach, setAttach] = useState<BulkAttachments>(EMPTY_ATTACHMENTS);
  const [audioMode, setAudioMode] = useState<"file" | "mic" | null>(null);
  const [audioText, setAudioText] = useState("");
  const sttFn = useServerFn(transcribeAudio);
  const parseFileFn = useServerFn(parseFlashcardsFromFile);
  const { lang: uiLang, extLang } = useLang();
  const contentLanguage = validatedExtLanguage(extLang);
  const outputLang = contentLanguage ?? uiLang;
  const transcriptFn = useServerFn(getYoutubeTranscript);
  const webPageFn = useServerFn(getWebPageText);
  const planFn = useServerFn(planWebPages);
  const imageFn = useServerFn(getWebImage);
  const saveFn = useServerFn(saveFlashcardsAtomically);
  const resolveNamesFn = useServerFn(resolveDestinationNamesFn);
  const matchFn = useServerFn(createMatchGameFn);
  const [includeMatch, setIncludeMatch] = useState(false);
  const navigate = useNavigate();
  const billing = useAiBillingInfo();
  const { isActive: isPro } = useSubscription();
  const cardCount = useQuery({
    queryKey: ["bulkv2-card-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  const freeLeft = isPro ? null : Math.max(0, FREE_CARD_LIMIT - (cardCount.data ?? 0));
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [sheetAi, setSheetAi] = useState(false);
  const [sheetDialog, setSheetDialog] = useState(false);
  const [coinDialog, setCoinDialog] = useState<null | {
    kind: "low" | "confirm";
    n: number;
    cost: number;
    balance: number;
    perCard: number;
  }>(null);
  const confirmedRef = useRef(false);
  const autoConfirmRef = useRef<((confirmed: boolean) => void) | null>(null);
  function closeCoinDialog(confirmed = false) {
    setCoinDialog(null);
    const resolve = autoConfirmRef.current;
    autoConfirmRef.current = null;
    resolve?.(confirmed);
  }
  const ytPreparedRef = useRef<{
    url: string;
    title: string;
    text: string;
    language: string;
  } | null>(null);
  const ytLangRef = useRef<string | null>(null);
  const genLangRef = useRef<string | null>(null);
  const [ytDialog, setYtDialog] = useState<null | {
    mismatchFrom: string | null;
    longChars: number | null;
  }>(null);

  async function handleSheetFile(file: File | undefined) {
    if (!file) return;
    setSheet(null);
    setSheetAi(false);
    try {
      const data = await readSheet(file);
      if (!data.rows.length) return toast.error(T("Não encontramos dados nesta planilha."));
      if (data.cols <= 2) {
        let cards = sheetToCards(data, { q: T("Pergunta"), a: T("Resposta") });
        const total = cards.length;
        if (!total) return toast.error(T("Não encontramos dados nesta planilha."));
        if (total > SHEET_MAX_ROWS) {
          cards = cards.slice(0, SHEET_MAX_ROWS);
          toast.warning(
            T(
              "A planilha tem {total} linhas. Para manter o app leve, importamos as primeiras {n}. Salve e importe o restante em seguida.",
              { total, n: SHEET_MAX_ROWS },
            ),
          );
        }
        setRows((rs) => [
          ...rs,
          ...cards.map((c) => ({ id: nextRowId++, question: c.question, answer: c.answer })),
        ]);
        toast.success(
          T("{n} flashcards importados da planilha, sem custo de FlashCoins. Revise e salve.", {
            n: cards.length,
          }),
        );
        if (freeLeft !== null && cards.length > freeLeft)
          toast.info(T("Plano gratuito: você ainda pode salvar {n} cards.", { n: freeLeft }));
      } else {
        setSheet(data);
        setSheetDialog(true);
      }
    } catch {
      toast.error(T("Não foi possível ler a planilha. Confira se o arquivo é CSV, XLSX ou XLS."));
    }
  }

  function receiveFiles(source: string, incoming: File[]) {
    if (generating || saving || !incoming.length) return;
    if (source === "csv") {
      void handleSheetFile(incoming[0]);
      return;
    }
    if (source === "doc") {
      setFiles(incoming.slice(0, 1));
      return;
    }
    if (source === "audio") {
      setFiles(incoming.slice(0, 1));
      return;
    }
    const images = incoming.filter((file) => file.type.startsWith("image/"));
    setFiles((current) => [...current, ...images]);
  }

  // Ctrl+V ou botão direito > Colar em qualquer ponto da tela: imagens viram anexos.
  const captureRef = useRef(capture);
  captureRef.current = capture;
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (captureRef.current !== "image") return;
      const imgs = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (!imgs.length) return;
      e.preventDefault();
      const stamp = Date.now();
      setFiles((fs) => [
        ...fs,
        ...imgs.map((f, i) =>
          f.name && f.name !== "image.png"
            ? f
            : new File([f], `colada-${stamp}-${i}.png`, { type: f.type }),
        ),
      ]);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function resetAll() {
    setCapture(null);
    setText("");
    setYoutube("");
    setWebUrl("");
    setFiles([]);
    setRows([]);
    setAudioMode(null);
    setAudioText("");
    setInstructions("");
    setScope("all");
    setQuantity(10);
    setQuantityRaw("10");
    setAttach(EMPTY_ATTACHMENTS);
    setIncludeMatch(false);
    ytPreparedRef.current = null;
    ytLangRef.current = null;
    genLangRef.current = null;
    setSheet(null);
    setSheetAi(false);
    void cardCount.refetch();
    void billing.refetch();
  }

  async function handleGenerate() {
    if (generating) return;
    // Trava preventiva: "Meus tópicos" exige instruções ANTES de qualquer
    // requisição, chamada de IA ou checagem/débito de saldo.
    if (scope === "topics" && !instructions.trim()) {
      toast.error(t.instructionsRequiredError);
      blinkInstructions();
      return;
    }
    if (capture === "csv") {
      if (!sheet) return toast.error(T("Envie uma planilha primeiro."));
      if (!sheetAi) return setSheetDialog(true);
      if (!instructions.trim())
        return toast.error(
          T("Explique nas instruções quais colunas são perguntas e quais são respostas."),
        );
    }
    const webUrls = capture === "web" ? parseWebUrls(webUrl) : [];
    if (capture === "web") {
      if (!webUrls.length || webUrls.some((u) => !isValidWebPageUrl(u)))
        return toast.error(webPageErrorMessage(new Error("WEB_INVALID_URL")));
      if (webUrls.length > WEB_PAGES_BULK_MAX)
        return toast.error(T("Máximo de {n} páginas por vez", { n: WEB_PAGES_BULK_MAX }));
    }
    // Checagem prévia de saldo (prevenção de estresse em uso pesado).
    const info = billing.data ?? (await billing.refetch()).data;
    if (info && !autoQuantity && !(info as { isOwner?: boolean }).isOwner) {
      const perCard = info.prices.bulk ?? 1;
      const cost = quantity * perCard * Math.max(1, webUrls.length);
      if (info.balance < cost) {
        return setCoinDialog({ kind: "low", n: quantity, cost, balance: info.balance, perCard });
      }
      if (quantity >= HARD_USE_CARDS && !confirmedRef.current) {
        return setCoinDialog({
          kind: "confirm",
          n: quantity,
          cost,
          balance: info.balance,
          perCard,
        });
      }
    }
    confirmedRef.current = false;
    const mode = scope === "all" ? "total" : scope === "topics" ? "sections" : "sample";
    let sourceText = "";
    let images: string[] = [];
    let name = T("Texto enviado");
    let hint = instructions.trim().slice(0, 400);
    let videoUrl: string | null = null;
    setGenerating(true);
    const sourceCap = isPro ? SOURCE_MAX_CHUNKS * SOURCE_CHUNK_CHARS : 30_000;
    const prepareChunks = (text: string) => {
      const body = mode === "sections" && text ? focusSourceRange(text, instructions) : text;
      return (body ? splitSourceChunks(body) : [""]).slice(0, SOURCE_MAX_CHUNKS);
    };
    const approveAutomaticRun = async (chunks: string[]) => {
      const current = (await billing.refetch()).data;
      if (!current) throw new Error(T("Não foi possível verificar o saldo. Tente novamente."));
      const n = automaticCardCounts(chunks, isPro).reduce((sum, count) => sum + count, 0);
      const check = generationCostCheck(n, current.prices.bulk ?? 1, current.balance, current.isOwner === true);
      if (!check.kind) return true;
      if (check.kind === "low") {
        setCoinDialog({ ...check, kind: "low" });
        return false;
      }
      return new Promise<boolean>((resolve) => {
        autoConfirmRef.current = resolve;
        setCoinDialog({ ...check, kind: "confirm" });
      });
    };
    /** Long sources: ordered chunks, one job per chunk, cards appended in source order. */
    const generateInChunks = async (opts: {
      text: string;
      images: string[];
      docName: string;
      docHint: string;
      lang: string;
      label?: string;
      quantity?: number;
    }) => {
      const chunks = prepareChunks(opts.text);
      if (splitSourceChunks(opts.text).length > SOURCE_MAX_CHUNKS) {
        toast.info(T("Material muito longo: processaremos os primeiros {n} blocos.", { n: SOURCE_MAX_CHUNKS }));
      }
      const counts = autoQuantity ? automaticCardCounts(chunks, isPro) : distributeCards(opts.quantity ?? quantity, chunks.length);
      const out: Array<{ question: string; answer: string; jobId: string; outputId?: string }> = [];
      let failures = 0;
      const failedParts: number[] = [];
      let firstError: unknown = null;
      for (const [i, chunk] of chunks.entries()) {
        if (chunks.length > 1)
          toast.loading(
            T("{label}Bloco {i} de {n}… {c} flashcards prontos", {
              label: opts.label ? `${opts.label} · ` : "",
              i: i + 1,
              n: chunks.length,
              c: out.length,
            }),
            { id: "web-progress" },
          );
        for (let attempt = 0; attempt < 2; attempt++) try {
          const chunkImages = chunks.length === 1 ? opts.images : [];
          const chunkName = chunks.length > 1 ? `${opts.docName} (${i + 1}/${chunks.length})` : opts.docName;
          const job = await createDocumentJob({
            actionId: crypto.randomUUID(),
            documentName: chunkName,
            mode,
            totalParts: 1,
            requestedCards: counts[i],
            slices: chunk ? [chunk] : [],
            images: chunkImages,
            hint: opts.docHint,
            focus: instructions.trim().slice(0, 2000) || undefined,
          });
          const result = await parseFileFn({
            data: {
              actionId: crypto.randomUUID(),
              jobId: job.id,
              requestedCards: counts[i],
              text: chunk,
              images: chunkImages,
              hint: opts.docHint,
              mode,
              outputLang: opts.lang,
              focus: instructions.trim().slice(0, 2000) || undefined,
              ...(chunks.length > 1 ? { part: i + 1, parts: chunks.length } : {}),
            },
          });
          out.push(...result.cards.map((c) => ({ question: c.question, answer: c.answer, jobId: job.id, outputId: c.generatedOutputId ?? undefined })));
          break;
        } catch (e) {
          if (attempt === 0) continue;
          if (chunks.length === 1) throw e;
          failures += 1;
          firstError ??= e;
          failedParts.push(i + 1);
        }
      }
      if (!out.length && firstError) throw firstError;
      if (failures)
        toast.warning(
          T("Material dividido em {n} trechos. {ok} foram concluídos e {f} falharam mesmo após nova tentativa (trechos {list}). Os cards prontos estão abaixo; gere de novo só os trechos pendentes.", {
            n: chunks.length,
            ok: chunks.length - failures,
            f: failures,
            list: failedParts.join(", "),
          }),
          { duration: 20000 },
        );
      return out;
    };
    try {
      if (capture === "text") {
        sourceText = text.trim();
        if (!sourceText) throw new Error(T("Cole ou digite o conteúdo primeiro."));
      } else if (capture === "doc") {
        const file = files[0];
        if (!file) throw new Error(T("Não foi possível ler o arquivo."));
        sourceText = await readDocumentText(file, sourceCap, {
          truncate: true,
          onTruncate: () =>
            toast.info(
              isPro
                ? T("Material muito longo: processaremos os primeiros {n} blocos.", { n: SOURCE_MAX_CHUNKS })
                : T("Conta de teste: usamos os primeiros {n} caracteres do documento. Assinantes leem livros e apostilas inteiros.", { n: (30_000).toLocaleString() }),
            ),
        });
        name = file.name;
      } else if (capture === "csv" && sheet) {
        const full = sheetToText(sheet);
        if (full.length > SHEET_AI_MAX_CHARS)
          toast.info(
            T("Planilha grande: o PilotAI lerá apenas o primeiro bloco (até 30 mil caracteres)."),
          );
        sourceText = `Spreadsheet "${sheet.name}" (columns separated by " | "). User instructions: ${instructions.trim()}\n\n${full.slice(0, SHEET_AI_MAX_CHARS)}`;
        name = sheet.name;
      } else if (capture === "youtube") {
        if (!canonicalYoutubeUrl(youtube)) throw new Error(T("Link do YouTube inválido"));
        let tr = ytPreparedRef.current;
        if (!tr) {
          tr = await transcriptFn({ data: { url: youtube, lang: getUiLang() } });
          const mismatch = needsTranslationChoice(tr.language, outputLang);
          const longChars =
            isPro && tr.text.length > YOUTUBE_COST_WARN_CHARS ? tr.text.length : null;
          if (mismatch || longChars) {
            ytPreparedRef.current = tr;
            setYtDialog({ mismatchFrom: mismatch ? tr.language : null, longChars });
            return;
          }
        }
        ytPreparedRef.current = null;
        if (!isPro && tr.text.length > YOUTUBE_TRIAL_CHARS)
          toast.info(
            T(
              "Conta de teste: usamos os primeiros {n} caracteres do vídeo. Assinantes leem o vídeo inteiro.",
              {
                n: YOUTUBE_TRIAL_CHARS.toLocaleString(),
              },
            ),
          );
        sourceText = isPro ? tr.text : tr.text.slice(0, YOUTUBE_TRIAL_CHARS);
        name = tr.title;
        videoUrl = tr.url;
        hint = `YouTube source: ${tr.url}`;
      } else if (capture === "web") {
        const created: DraftRow[] = [];
        let failures = 0;
        let firstError: unknown = null;
        toast.loading(T("Lendo e catalogando as páginas…"), { id: "web-progress" });
        const plan = await planFn({ data: { urls: webUrls, lang: outputLang } });
        failures += plan.failed;
        if (!plan.pages.length) throw new Error(plan.firstError ?? "WEB_FETCH_FAILED");
        type WebUnit = {
          url: string;
          title: string;
          text: string | null;
          images: string[];
          core: boolean;
          destination: { subject: string; topic: string; subtopic?: string };
        };
        const units: WebUnit[] = [];
        for (const page of plan.pages) {
          const subject = page.subject || page.topic;
          if (page.kind === "hub") {
            // Página-índice: cada item é um assunto da matéria; o índice em si não gera cards.
            for (const sub of page.subpages)
              units.push({
                url: sub.url,
                title: sub.subtopic,
                text: null,
                images: [],
                core: false,
                destination: { subject, topic: sub.subtopic },
              });
            continue;
          }
          units.push({
            url: page.url,
            title: page.title,
            text: page.text,
            images: page.images,
            core: true,
            destination: { subject, topic: page.topic },
          });
          for (const sub of page.subpages)
            units.push({
              url: sub.url,
              title: sub.subtopic,
              text: null,
              images: [],
              core: false,
              destination: { subject, topic: page.topic, subtopic: sub.subtopic },
            });
        }
        // Itens extras só entram se o saldo cobrir; as páginas principais têm prioridade.
        const unitPrice = (info?.prices.bulk ?? 1) * quantity;
        if (info && !autoQuantity) {
          const affordable = Math.max(1, Math.floor(info.balance / unitPrice));
          if (units.length > affordable) {
            const roots = units.filter((u) => u.core);
            const subs = units.filter((u) => !u.core);
            units.length = 0;
            units.push(...roots, ...subs.slice(0, Math.max(0, affordable - roots.length)));
            toast.info(T("Saldo insuficiente para todas as subpáginas; algumas foram deixadas de fora."));
          }
        }
        // Read every automatic source before requesting approval or generating any cards.
        const preparedUnits: WebUnit[] = [];
        if (autoQuantity) {
          for (const unit of units) {
            try {
              const page = unit.text === null ? await webPageFn({ data: { url: unit.url } }) : null;
              preparedUnits.push({ ...unit, text: (page?.text ?? unit.text ?? "").slice(0, sourceCap), title: page?.title || unit.title });
            } catch (error) {
              failures += 1;
              firstError ??= error;
            }
          }
          if (!preparedUnits.length) throw firstError ?? new Error("WEB_FETCH_FAILED");
          toast.dismiss("web-progress");
          if (!(await approveAutomaticRun(preparedUnits.flatMap((unit) => prepareChunks(unit.text ?? ""))))) return;
        }
        for (const [index, unit] of (autoQuantity ? preparedUnits : units).entries()) {
          toast.loading(
            T("Página {i} de {n}: {name}", { i: index + 1, n: units.length, name: unit.title || unit.url }),
            { id: "web-progress" },
          );
          try {
            let pageText = unit.text;
            let pageTitle = unit.title;
            if (pageText === null) {
              const sub = await webPageFn({ data: { url: unit.url } });
              pageText = sub.text;
              pageTitle = sub.title || unit.title;
            }
            pageText = pageText.slice(0, sourceCap);
            const pageImages: string[] = [];
            for (const imageUrl of unit.images) {
              const image = await imageFn({ data: { url: imageUrl } }).catch(() => null);
              if (image?.dataUrl) pageImages.push(image.dataUrl);
            }
            const legalPage = unit.core ? splitLegalText(pageText, pageTitle) : null;
            if (legalPage) {
              const share = distributeCards(quantity, legalPage.units.length);
              for (const [li, lu] of legalPage.units.entries()) {
                if (!autoQuantity && !share[li]) continue;
                const luCards = await generateInChunks({ quantity: share[li], text: lu.text, images: [], docName: pageTitle || legalPage.subject, docHint: `Web source: ${unit.url}`, lang: outputLang });
                created.push(...luCards.map((c) => ({ id: nextRowId++, question: c.question, answer: c.answer, jobId: c.jobId, outputId: c.outputId, destination: { subject: legalPage.subject, topic: lu.topic, ...(lu.subtopic ? { subtopic: lu.subtopic } : {}) } })));
              }
              continue;
            }
            const pageCards = await generateInChunks({
              text: pageText,
              images: pageImages,
              docName: pageTitle || new URL(unit.url).hostname,
              docHint: `Web source: ${unit.url}`,
              lang: outputLang,
              label: T("Página {i} de {n}", { i: index + 1, n: units.length }),
            });
            if (!pageCards.length) throw new Error("WEB_NO_CONTENT");
            created.push(
              ...pageCards.map((c) => ({
                id: nextRowId++,
                question: c.question,
                answer: c.answer,
                jobId: c.jobId,
                outputId: c.outputId,
                destination: unit.destination,
              })),
            );
          } catch (pageError) {
            failures += 1;
            firstError ??= pageError;
          }
        }
        toast.dismiss("web-progress");
        if (!created.length) throw firstError ?? new Error("WEB_FETCH_FAILED");
        setRows((rs) => [...rs, ...created]);
        if (failures) toast.warning(T("Algumas páginas não puderam ser lidas: {n}", { n: failures }));
        toast.success(T("Flashcards prontos para revisão."));
        return;
      } else if (capture === "audio") {
        let spoken = audioMode === "mic" ? audioText.trim() : "";
        if (audioMode !== "mic") {
          const f = files.find(
            (x) => x.type.startsWith("audio/") || /\.(mp3|m4a|wav|aac|ogg|webm)$/i.test(x.name),
          );
          if (!f) throw new Error(T("Narre um trecho ou envie um arquivo de áudio."));
          if (f.size > 6_000_000) throw new Error(T("Arquivo de áudio muito grande (máx. 6 MB)."));
          const b64 = await fileToDataUrl(f);
          const tr = await sttFn({
            data: { audio_base64: b64, mime_type: f.type || "audio/webm", lang: getUiLang() },
          });
          spoken = (tr.text ?? "").trim();
          name = f.name;
        } else name = T("Áudio narrado");
        if (!spoken) throw new Error(T("Narre um trecho ou envie um arquivo de áudio."));
        sourceText = spoken.slice(0, 30_000);
      } else if (capture === "photo" || capture === "image") {
        const imgs = files.filter((f) => /^image\/(png|jpeg|webp)$/i.test(f.type)).slice(0, 20);
        if (!imgs.length) throw new Error(T("Adicione ao menos uma foto ou imagem."));
        images = await Promise.all(imgs.map(fileToDataUrl));
        name = T("Fotos enviadas");
      } else {
        throw new Error(
          T("Esta origem será ligada na próxima etapa. Use texto, fotos, imagens ou YouTube."),
        );
      }
      // Legislation: subject = law title, assunto/tópico = headings right above the articles.
      const legal = !images.length ? splitLegalText(sourceText, name) : null;
      if (legal) {
        if (autoQuantity && !(await approveAutomaticRun(legal.units.flatMap((u) => prepareChunks(u.text))))) return;
        const legalRows: DraftRow[] = [];
        const share = distributeCards(quantity, legal.units.length);
        for (const [li, lu] of legal.units.entries()) {
          if (!autoQuantity && !share[li]) continue;
          const luCards = await generateInChunks({ quantity: share[li], text: lu.text, images: [], docName: name, docHint: hint, lang: outputLang });
          legalRows.push(...luCards.map((c) => ({ id: nextRowId++, question: c.question, answer: c.answer, jobId: c.jobId, outputId: c.outputId, videoUrl, destination: { subject: legal.subject, topic: lu.topic, ...(lu.subtopic ? { subtopic: lu.subtopic } : {}) } })));
        }
        if (!legalRows.length) throw new Error(T("O PilotAI não encontrou conteúdo para flashcards."));
        setRows((rs) => [...rs, ...legalRows]);
        toast.success(T("Flashcards prontos para revisão."));
        return;
      }
      if (autoQuantity && !(await approveAutomaticRun(prepareChunks(sourceText)))) return;
      const cards = await generateInChunks({
        text: sourceText,
        images,
        docName: name,
        docHint: hint,
        lang: ytLangRef.current ?? outputLang,
      });
      genLangRef.current = ytLangRef.current;
      ytLangRef.current = null;
      if (!cards.length)
        throw new Error(T("O PilotAI não encontrou conteúdo para flashcards."));
      setRows((rs) => [
        ...rs,
        ...cards.map((c) => ({
          id: nextRowId++,
          question: c.question,
          answer: c.answer,
          jobId: c.jobId,
          outputId: c.outputId,
          videoUrl,
        })),
      ]);
      toast.success(T("Flashcards prontos para revisão."));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(
        msg.includes("YOUTUBE_")
          ? youtubeErrorMessage(error)
          : isWebPageError(error)
            ? webPageErrorMessage(error)
            : friendlyAiError(error, { busy: t.busyError }).text,
      );
    } finally {
      toast.dismiss("web-progress");
      setGenerating(false);
    }
  }

  async function ensureDestination(
    subjectName: string,
    topicName: string,
    subtopicName?: string,
  ): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("AUTH_REQUIRED");
    const like = (value: string) => value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const subjectLabel = subjectName.trim().slice(0, 120);
    const topicLabel = topicName.trim().slice(0, 120);
    const { data: foundSubject } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", like(subjectLabel))
      .limit(1)
      .maybeSingle();
    let subjectIdFound = foundSubject?.id ?? null;
    if (!subjectIdFound) {
      const color = SUBJECT_COLORS[(subjects.data?.length ?? 0) % SUBJECT_COLORS.length];
      const { data, error } = await supabase
        .from("subjects")
        .insert({ user_id: user.id, name: subjectLabel, color, language: contentLanguage })
        .select("id")
        .single();
      if (error) throw error;
      subjectIdFound = data.id;
    }
    const ensureTopic = async (name: string, parentId: string | null): Promise<string> => {
      let query = supabase.from("topics").select("id").eq("subject_id", subjectIdFound);
      query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
      const { data: found } = await query.ilike("name", like(name)).limit(1).maybeSingle();
      if (found?.id) return found.id;
      let siblingQuery = supabase.from("topics").select("order_index").eq("subject_id", subjectIdFound);
      siblingQuery = parentId ? siblingQuery.eq("parent_id", parentId) : siblingQuery.is("parent_id", null);
      const { data: siblings, error: siblingError } = await siblingQuery;
      if (siblingError) throw siblingError;
      const { data, error } = await supabase
        .from("topics")
        .insert({ user_id: user.id, subject_id: subjectIdFound, name, parent_id: parentId, order_index: nextSourceIndex(siblings ?? []) })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    };
    const topicIdFound = await ensureTopic(topicLabel, null);
    const subtopicLabel = subtopicName?.trim().slice(0, 120);
    return subtopicLabel ? ensureTopic(subtopicLabel, topicIdFound) : topicIdFound;
  }

  async function handleSave() {
    const target = subtopicId || topicId;
    const ready = rows.filter((r) => r.question.trim() && r.answer.trim());
    const aiNamed =
      !target && ready.length > 0 && ready.every((r) => r.destination?.subject?.trim() && r.destination.topic?.trim());
    if (!ready.length || saving) return;
    setSaving(true);
    if (!target && !aiNamed) {
      // Any source without a chosen destination: PilotAI names subject/topic automatically.
      let names = { subject: "", topic: "" };
      try {
        names = await resolveNamesFn({
          data: {
            lang: genLangRef.current ?? outputLang,
            cards: ready.slice(0, 12).map((r) => ({
              question: r.question.trim().slice(0, 2000),
              answer: r.answer.trim().slice(0, 4000),
            })),
          },
        });
      } catch {
        names = { subject: "", topic: "" };
      }
      const subject = names.subject || ready[0]?.question.trim().slice(0, 60) || "";
      const topic = names.topic || subject;
      for (const r of ready) if (!r.destination?.subject?.trim() || !r.destination.topic?.trim()) r.destination = { subject, topic };
    }
    let inserted = 0;
    const savedTopics: SavedContentTopic[] = [];
    try {
      const groups = new Map<string, { topicId: string; rows: DraftRow[] }>();
      if (target) groups.set(target, { topicId: target, rows: ready });
      else {
        for (const r of ready) {
          const destination = r.destination;
          if (!destination) throw new Error("DESTINATION_REQUIRED");
          const { subject, topic, subtopic } = destination;
          const key = `${subject.trim().toLowerCase()}|${topic.trim().toLowerCase()}|${(subtopic ?? "").trim().toLowerCase()}`;
          let group = groups.get(key);
          if (!group) {
            group = { topicId: await ensureDestination(subject, topic, subtopic), rows: [] };
            groups.set(key, group);
          }
          group.rows.push(r);
        }
      }
      for (const group of groups.values()) {
        const { data: lastCard } = await supabase
          .from("flashcards")
          .select("order_index")
          .eq("topic_id", group.topicId)
          .not("order_index", "is", null)
          .order("order_index", { ascending: false })
          .limit(1)
          .maybeSingle();
        const baseOrder = Number(lastCard?.order_index ?? 0);
        const res = await saveFn({
          data: {
            actionId: crypto.randomUUID(),
            cards: group.rows.map((r, i) => ({
              topicId: group.topicId,
              orderIndex: baseOrder + i + 1,
              question: r.question.trim(),
              answer: r.answer.trim(),
              videoUrl1: attach.video1 ?? r.videoUrl ?? null,
              videoUrl2: attach.video2 ?? null,
              linkedNoteId: attach.noteId,
              imageUrl: attach.imagePath,
              imageCategoryId: attach.imageCategoryId,
              generatedJobId: r.outputId ? (r.jobId ?? null) : null,
              generatedOutputId: r.outputId ?? null,
            })),
          },
        });
        inserted += res.insertedCount;
        if (res.insertedCount > 0) savedTopics.push({ id: group.topicId, cardCount: res.insertedCount });
        // Progressive discard: saved rows leave the draft so a retry never resends them.
        const savedIds = new Set(group.rows.map((r) => r.id));
        setRows((prev) => prev.filter((r) => !savedIds.has(r.id)));
      }
      void queryClient.invalidateQueries({ queryKey: ["bulkv2-subjects"] });
      toast.success(T("Flashcards criados com sucesso!") + ` (${inserted})`);
      if (includeMatch) {
        try {
          for (const group of groups.values()) {
            const game = await matchFn({
              data: {
                actionId: crypto.randomUUID(),
                topicId: group.topicId,
                language: genLangRef.current ?? outputLang,
                cards: group.rows
                  .slice(0, 60)
                  .map((r) => ({ question: r.question.trim(), answer: r.answer.trim() })),
              },
            });
            toast.success(
              `${T("FlashMatch criado!")} (${game.roundCount} ${game.roundCount === 1 ? T("rodada") : T("rodadas")})`,
            );
            void queryClient.invalidateQueries({ queryKey: ["topic-match-games", group.topicId] });
          }
        } catch (matchError) {
          toast.warning(
            T("Os flashcards foram criados, mas não foi possível criar o FlashMatch agora.") +
              (matchError instanceof Error && matchError.message ? ` ${matchError.message}` : ""),
          );
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["ai-billing"] }),
      ]);
      resetAll();
      setSavedContent(savedTopics);
    } catch (error) {
      if (inserted > 0) {
        void queryClient.invalidateQueries({ queryKey: ["bulkv2-subjects"] });
        setSavedContent(savedTopics);
        toast.error(
          `${inserted} ${T("flashcard(s) já foram salvos.")} ${T("A conexão foi interrompida antes do fim. Toque em Criar novamente para salvar apenas os que faltam.")}`,
          { duration: 10000 },
        );
      } else {
        toast.error(friendlyAiError(error, { busy: t.busyError }).text);
      }
    } finally {
      setSaving(false);
    }
  }
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [subtopicId, setSubtopicId] = useState("");
  const queryClient = useQueryClient();

  async function createSubject(name: string): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const color = SUBJECT_COLORS[(subjects.data?.length ?? 0) % SUBJECT_COLORS.length];
    const { data, error } = await supabase
      .from("subjects")
      .insert({ user_id: user.id, name, color, language: contentLanguage })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    await queryClient.invalidateQueries({ queryKey: ["bulkv2-subjects"] });
    return data.id;
  }

  async function createTopic(name: string, parentId?: string): Promise<string | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !subjectId) return null;
    const { data, error } = await supabase
      .from("topics")
      .insert({ user_id: user.id, subject_id: subjectId, name, parent_id: parentId ?? null })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    await queryClient.invalidateQueries({ queryKey: ["bulkv2-topics"] });
    return data.id;
  }

  const subjects = useQuery({
    queryKey: ["bulkv2-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const topics = useQuery({
    queryKey: ["bulkv2-topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, subject_id, parent_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const topicOpts = useMemo(
    () =>
      subjectId
        ? (topics.data ?? []).filter((x) => x.subject_id === subjectId && !x.parent_id)
        : [],
    [topics.data, subjectId],
  );
  const subtopicOpts = useMemo(
    () => (topicId ? (topics.data ?? []).filter((x) => x.parent_id === topicId) : []),
    [topics.data, topicId],
  );

  const filled = rows.filter((r) => r.question.trim() && r.answer.trim()).length;

  const scopeOptions: {
    id: Scope;
    icon: LucideIcon;
    label: string;
    desc: string;
    costNote?: string;
  }[] = [
    { id: "all", icon: Layers, label: t.scopeAll, desc: t.scopeAllDesc, costNote: t.scopeAllCost },
    { id: "topics", icon: ListChecks, label: t.scopeTopics, desc: t.scopeTopicsDesc },
    { id: "ai", icon: Sparkles, label: t.scopeAi, desc: t.scopeAiDesc },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 pb-16 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      {/* Passo 1 — Origem da captura */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t.stepCapture}</h2>
        <BulkV2CaptureSelector
          capture={capture}
          audioMode={audioMode}
          t={t}
          disabled={generating || saving}
          micValue={audioText}
          micOnChange={setAudioText}
          micLang={getUiLang()}
          onSelect={(source, mode) => {
            if (capture !== source || (mode && mode !== audioMode)) setFiles([]);
            setCapture(source);
            if (mode) setAudioMode(mode);
            if (source === "doc" || source === "csv" || (source === "audio" && mode === "file")) {
              fileInputs.current[source]?.click();
            }
          }}
        />

        {Object.entries(FILE_ACCEPT).map(([source, accept]) => (
          <input
            key={source}
            ref={(input) => {
              fileInputs.current[source] = input;
            }}
            type="file"
            accept={accept}
            multiple={source === "image"}
            className="hidden"
            disabled={generating || saving}
            onChange={(event) => {
              receiveFiles(source, Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        ))}

        {capture && (
          <div className="space-y-4 border-t border-border pt-4 animate-in fade-in slide-in-from-top-2">
            {capture === "text" && (
              <textarea
                aria-label={t.typeText}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                placeholder={T("Cole ou digite o conteúdo aqui…")}
                className="w-full resize-y rounded-md border border-border bg-background p-4 text-base leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
            {capture === "youtube" && <YouTubeSourceInput value={youtube} onChange={setYoutube} />}
            {capture === "web" && <WebPageSourceInput value={webUrl} onChange={setWebUrl} disabled={generating} max={WEB_PAGES_BULK_MAX} />}
            {capture === "audio" && (
              <div className="space-y-3">
                {audioMode === "mic" && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {T("Leia pausadamente o trecho que você deseja transformar em flashcard.")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {T(
                        "Toque no microfone para começar e toque de novo para terminar (até 3 min).",
                      )}
                    </p>
                    <textarea
                      aria-label={t.narrateAudio}
                      value={audioText}
                      onChange={(e) => setAudioText(e.target.value)}
                      rows={4}
                      placeholder={T("O texto narrado aparece aqui…")}
                      className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}
                {audioMode && (
                  <p className="text-xs text-muted-foreground">
                    🔒{" "}
                    {T(
                      "Seu áudio e o texto transcrito são usados só para criar os flashcards e descartados após o processamento. Nada é salvo.",
                    )}
                  </p>
                )}
              </div>
            )}
            {(capture === "image" ||
              capture === "photo" ||
              capture === "doc" ||
              capture === "csv") && (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  receiveFiles(
                    capture === "photo" ? "image" : capture,
                    Array.from(event.dataTransfer.files),
                  );
                }}
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center sm:p-6"
              >
                {capture === "image" || capture === "photo" ? (
                  <>
                    <ImageIcon className="h-8 w-8 text-primary" aria-hidden />
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button
                        type="button"
                        disabled={generating || saving}
                        onClick={() => fileInputs.current.image?.click()}
                      >
                        <Upload className="h-4 w-4 shrink-0" /> {T("Escolher arquivos")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={generating || saving}
                        onClick={() => setCameraOpen(true)}
                        className="h-auto min-h-10 max-w-full whitespace-normal"
                      >
                        <Camera className="h-4 w-4 shrink-0" /> {t.takePhoto}
                      </Button>
                    </div>
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      role="textbox"
                      aria-label={t.pasteHint}
                      data-ph={t.pasteHint}
                      onBeforeInput={(e) => e.preventDefault()}
                      onInput={(e) => {
                        if (e.currentTarget.textContent) e.currentTarget.textContent = "";
                      }}
                      className="paste-pad min-h-[64px] w-full cursor-text rounded-md px-3 py-2 text-sm text-muted-foreground outline-none transition-colors focus:ring-2 focus:ring-primary/30"
                    />
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={generating || saving}
                    onClick={() => fileInputs.current[capture]?.click()}
                    aria-label={capture === "csv" ? t.groupSheets : t.captureDoc}
                    className="h-auto min-h-20 w-full flex-col gap-2 whitespace-normal hover:bg-primary/5 hover:text-foreground"
                  >
                    <FileText className="h-8 w-8 text-primary" aria-hidden />
                    <span>{capture === "csv" ? t.groupSheets : t.captureDoc}</span>
                  </Button>
                )}
              </div>
            )}
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 border-t border-border py-2 text-sm text-foreground"
                  >
                    <span className="min-w-0 truncate">{f.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t.remove}
                      disabled={generating || saving}
                      onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {capture === "csv" && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {T(
                "Use duas colunas: Pergunta e Resposta. Importação direta, sem custo de FlashCoins.",
              )}
            </span>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => void handleTemplateDownload(extLang || uiLang)}
              className="h-auto p-0 text-xs"
            >
              {T("Baixar planilha modelo (.xlsx)")}
            </Button>
            {sheet && sheetAi && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {sheet.name} · PilotAI
              </span>
            )}
          </div>
        )}
        <Dialog open={sheetDialog} onOpenChange={setSheetDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {T("Sua planilha tem {n} colunas ou dados espalhados", { n: sheet?.cols ?? 0 })}
              </DialogTitle>
              <DialogDescription>{T("Como prefere continuar?")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold text-foreground">
                  {T("Ajustar no modelo (sem custo)")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {T(
                    "Copie suas perguntas e respostas para a planilha modelo e envie de novo. Importação instantânea e gratuita.",
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    if (await handleTemplateDownload(extLang || uiLang)) {
                      setSheet(null);
                      setSheetDialog(false);
                    }
                  }}
                >
                  {T("Baixar planilha modelo (.xlsx)")}
                </Button>
              </div>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Coins className="h-4 w-4 text-amber-500" />
                  {T("Interpretar com o PilotAI (consome FlashCoins)")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {T(
                    "O PilotAI lê a planilha e cria os cards. Você paga apenas pelos cards salvos. Descreva nas instruções quais colunas são perguntas e respostas.",
                  )}
                </p>
                {sheet && sheetToText(sheet).length > SHEET_AI_MAX_CHARS && (
                  <p className="mt-1 text-xs text-amber-600">
                    {T(
                      "Planilha grande: o PilotAI lerá apenas o primeiro bloco (até 30 mil caracteres).",
                    )}
                  </p>
                )}
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setSheetAi(true);
                    setSheetDialog(false);
                  }}
                >
                  {T("Usar o PilotAI")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={!!ytDialog}
          onOpenChange={(o) => {
            if (!o) {
              setYtDialog(null);
              ytPreparedRef.current = null;
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{T("Antes de gerar a partir do vídeo")}</DialogTitle>
              <DialogDescription>
                {ytDialog?.mismatchFrom
                  ? T(
                      "O vídeo está em {from}. Quer que os cards e o FlashMatch nasçam traduzidos para {to}?",
                      {
                        from: languageLabel(ytDialog.mismatchFrom, uiLang),
                        to: languageLabel(outputLang, uiLang),
                      },
                    )
                  : null}
              </DialogDescription>
            </DialogHeader>
            {ytDialog?.longChars ? (
              <p className="text-sm text-muted-foreground">
                {T(
                  "Este vídeo tem {n} caracteres de transcrição. Textos acima de 100.000 caracteres demoram mais e consomem mais recursos de IA. Os FlashCoins continuam sendo cobrados só pelos cards que você salvar.",
                  {
                    n: ytDialog.longChars.toLocaleString(),
                  },
                )}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setYtDialog(null);
                  ytPreparedRef.current = null;
                }}
              >
                {T("Cancelar")}
              </Button>
              {ytDialog?.mismatchFrom ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    ytLangRef.current = ytDialog.mismatchFrom;
                    setYtDialog(null);
                    confirmedRef.current = true;
                    void handleGenerate();
                  }}
                >
                  {T("Manter no idioma original")}
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  ytLangRef.current = null;
                  setYtDialog(null);
                  confirmedRef.current = true;
                  void handleGenerate();
                }}
              >
                {ytDialog?.mismatchFrom ? T("Traduzir") : T("Continuar")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={!!coinDialog} onOpenChange={(o) => !o && closeCoinDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {coinDialog?.kind === "low"
                  ? T("Saldo insuficiente de FlashCoins")
                  : T("Confirmar consumo de FlashCoins")}
              </DialogTitle>
              <DialogDescription>
                {coinDialog &&
                  (coinDialog.kind === "low"
                    ? T(
                        "Você pediu até {n} flashcards (até {cost} FlashCoins), mas seu saldo é de {balance} FlashCoins.",
                        coinDialog,
                      )
                    : T(
                        "Esta geração pode consumir até {cost} FlashCoins ({n} cards). Seu saldo atual é de {balance}. Você só paga pelos cards que salvar.",
                        coinDialog,
                      ))}
              </DialogDescription>
            </DialogHeader>
            {freeLeft !== null && coinDialog && coinDialog.n > freeLeft && (
              <p className="text-xs text-muted-foreground">
                {T("Plano gratuito: você ainda pode salvar {n} cards.", { n: freeLeft })}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-2">
              {coinDialog?.kind === "low" ? (
                <>
                  {Math.floor(coinDialog.balance / coinDialog.perCard) > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const n = Math.max(1, Math.floor(coinDialog.balance / coinDialog.perCard));
                        setQuantity(n);
                        setQuantityRaw(String(n));
                        setAutoQuantity(false);
                        closeCoinDialog();
                      }}
                    >
                      {T("Ajustar para {n} cards", {
                        n: Math.floor(coinDialog.balance / coinDialog.perCard),
                      })}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      closeCoinDialog();
                      navigate({ to: "/store" });
                    }}
                  >
                    {T("Recarregar na Loja")}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => closeCoinDialog()}>
                    {T("Cancelar")}
                  </Button>
                  <Button
                    onClick={() => {
                      if (autoConfirmRef.current) {
                        closeCoinDialog(true);
                        return;
                      }
                      closeCoinDialog();
                      confirmedRef.current = true;
                      void handleGenerate();
                    }}
                  >
                    {T("Continuar")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <CameraCaptureDialog
          open={cameraOpen}
          onOpenChange={setCameraOpen}
          title={t.capturePhoto}
          onCapture={(f) => setFiles((fs) => [...fs, f])}
        />
      </section>

      {/* Passo 2 — Funil de escopo */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t.stepScope}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {scopeOptions.map((o) => {
            const Icon = o.icon;
            const active = scope === o.id;
            const pick = () => {
              setScope(o.id);
              if (o.id === "topics") blinkInstructions();
            };
            return (
              <div
                key={o.id}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                onClick={pick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick();
                  }
                }}
                className={cn(
                  "relative flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 text-left",
                  "transition-all duration-200 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:shadow-lg",
                  active
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/40"
                    : "border-border hover:border-primary/50",
                  o.costNote && "pr-11",
                )}
              >
                <Icon
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span>
                  <span className="block text-sm font-semibold text-foreground">{o.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{o.desc}</span>
                </span>
                {o.costNote ? (
                  <div
                    className="absolute right-1 top-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <CommerceItemInfo label={o.costNote} side="top" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <label className="ml-[5px] inline-block space-y-1.5">
          <span className="text-sm font-medium text-foreground">{t.quantity}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={quantityRaw}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
              setQuantityRaw(digits);
              const n = Number(digits);
              if (n >= 1) setQuantity(n);
            }}
            onBlur={() => {
              const n = Math.min(2500, Math.max(1, Number(quantityRaw) || 1));
              setQuantity(n);
              setQuantityRaw(String(n));
            }}
            disabled={autoQuantity}
            className="ml-[5px] w-[92px] rounded-md border border-border bg-background px-2 py-2 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40"
          />
        </label>
        <label className="ml-3 inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={autoQuantity}
            onChange={(e) => setAutoQuantity(e.target.checked)}
            disabled={generating}
            className="h-4 w-4 accent-primary"
          />
          {T("PilotAI decide a quantidade")}
        </label>
        <label className="block space-y-1.5">
          <span
            className={cn(
              "text-sm font-medium transition-colors duration-300",
              instrBlink ? "text-destructive" : "text-foreground",
            )}
          >
            {scope === "topics" ? t.instructionsRequired : t.instructions}
          </span>
          <div className="relative">
            <textarea
              ref={instructionsRef}
              value={instructions}
              onChange={(e) => {
                setInstructions(e.target.value);
                if (blinkTimerRef.current) {
                  window.clearInterval(blinkTimerRef.current);
                  blinkTimerRef.current = null;
                  setInstrBlink(false);
                }
              }}
              rows={3}
              placeholder={scope === "topics" ? t.instructionsRequiredPh : t.instructionsPh}
              className="w-full resize-y rounded-md border border-border bg-background py-2 pl-3 pr-12 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <MicButton
              value={instructions}
              onChange={(v) => {
                setInstructions(v);
                if (blinkTimerRef.current) {
                  window.clearInterval(blinkTimerRef.current);
                  blinkTimerRef.current = null;
                  setInstrBlink(false);
                }
              }}
              lang={getUiLang()}
              className="absolute right-2 top-2"
            />
          </div>
        </label>
      </section>

      {/* Passo 3 — Destino */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t.stepDestination}</h2>
        {capture === "web" && (
          <p className="text-xs text-muted-foreground">
            {T("Deixe vazio para o PilotAI nomear a matéria e o assunto de cada página.")}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <DestinationSelect
            label={t.subject}
            value={subjectId}
            onChange={(v) => {
              setSubjectId(v);
              setTopicId("");
              setSubtopicId("");
            }}
            opts={subjects.data ?? []}
            selectLabel={t.select}
            createLabel={T("Criar nova matéria")}
            namePlaceholder={T("Nome da nova matéria")}
            addLabel={T("Adicionar")}
            onCreate={createSubject}
          />
          <DestinationSelect
            label={t.topic}
            value={topicId}
            onChange={(v) => {
              setTopicId(v);
              setSubtopicId("");
            }}
            opts={topicOpts}
            disabled={!subjectId}
            selectLabel={t.select}
            createLabel={T("Criar novo assunto")}
            namePlaceholder={T("Nome do novo assunto")}
            addLabel={T("Adicionar")}
            onCreate={(n) => createTopic(n)}
          />
          <DestinationSelect
            label={`${t.subtopic} (${t.optional})`}
            value={subtopicId}
            onChange={setSubtopicId}
            opts={subtopicOpts}
            disabled={!topicId}
            selectLabel={t.select}
            createLabel={T("Criar novo tópico")}
            namePlaceholder={T("Nome do novo tópico")}
            addLabel={T("Adicionar")}
            onCreate={(n) => createTopic(n, topicId)}
          />
        </div>
        <FlashMatchOption
          checked={includeMatch}
          onChange={setIncludeMatch}
          disabled={generating || saving}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !capture}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-all duration-200 hover:scale-[1.01] hover:bg-primary/15 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {generating
            ? T("O PilotAI está criando seus flashcards…")
            : T("Gerar flashcards com o PilotAI")}
        </button>
      </section>

      {rows.length > 0 && (
        <BulkV2Attachments
          value={attach}
          onChange={setAttach}
          targetTopicId={subtopicId || topicId || null}
          sessionCards={rows}
        />
      )}

      {/* Passo 4 — Revisão */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">{t.stepReview}</h2>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
            <p className="text-sm font-medium text-foreground">{t.reviewEmpty}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{t.reviewHint}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, i) => {
              const upd = (k: "question" | "answer", v: string) =>
                setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [k]: v } : r)));
              return (
                <div
                  key={row.id}
                  className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md"
                >
                  <span className="mt-2 w-6 shrink-0 text-right text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <div className="flex items-start gap-1.5">
                      <textarea
                        value={row.question}
                        onChange={(e) => upd("question", e.target.value)}
                        placeholder={t.questionPh}
                        rows={2}
                        className="min-w-0 flex-1 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <MicButton
                        value={row.question}
                        onChange={(v) => upd("question", v)}
                        className="mt-1.5"
                      />
                    </div>
                    <div className="flex items-start gap-1.5">
                      <textarea
                        value={row.answer}
                        onChange={(e) => upd("answer", e.target.value)}
                        placeholder={t.answerPh}
                        rows={2}
                        className="min-w-0 flex-1 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <MicButton
                        value={row.answer}
                        onChange={(v) => upd("answer", v)}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t.remove}
                    onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                    className="mt-1 rounded-md p-1.5 text-muted-foreground transition-all hover:scale-110 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[1, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() =>
                setRows((rs) => [
                  ...rs,
                  ...Array.from({ length: n }, () => ({
                    id: nextRowId++,
                    question: "",
                    answer: "",
                  })),
                ])
              }
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:scale-[1.04] hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              {n}
            </button>
          ))}
        </div>
      </section>

      {/* Rodapé — cobrança justa + criar */}
      <ContentMapDialog topics={savedContent} onClose={() => setSavedContent([])} />
      <footer className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Coins className="h-4 w-4 text-amber-500" />
          {t.coinsNote(Math.max(filled, 0))}
        </p>
        <button
          type="button"
          disabled={filled === 0 || saving}
          onClick={handleSave}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground",
            "transition-all duration-200 hover:scale-[1.01] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none",
          )}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.createCards(filled)}
        </button>
      </footer>
    </div>
  );
}
