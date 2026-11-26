import { readTextFile } from "@/lib/decode-text";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

import { toast } from "sonner";
import { friendlyAiError, toastAiError } from "@/lib/ai-error-toast";
import {
  Plus,
  Trash2,
  Layers,
  Sparkles,
  ArrowLeft,
  Wand2,
  Loader2,
  Camera,
  X,
  ImagePlus,
  Crop,
  FileSpreadsheet,
  Link2,
  Image as ImageIcon,
  Upload,
  FolderPlus,
  Paperclip,
} from "lucide-react";
import { usePlanLimit, useUpgradeDialog } from "@/lib/plan-limit";
import { MicButton } from "@/components/MicButton";
import { parseFlashcardsFromImages } from "@/lib/parse-cards-image.functions";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { extractOrderFromText } from "@/lib/order-index";
import { NoteLinkPicker } from "@/components/NoteLinkPicker";
import { uploadMindMapImage } from "@/lib/mindmap-image";
import { VideoLinksPicker } from "@/components/VideoLinksPicker";
import { YouTubeSourceInput } from "@/components/YouTubeSourceInput";
import { getYoutubeTranscript } from "@/lib/youtube.functions";
import { youtubeErrorMessage } from "@/lib/youtube-errors";
import { canonicalYoutubeUrl } from "@/lib/youtube-url";
import { flattenCategoryTree, indentLabel, type FlatCat } from "@/lib/note-category-tree";
import { descendantsOf, flattenTopicTree, indentTopicLabel } from "@/lib/topic-tree";
import { useBulkT } from "@/lib/i18n-bulk";
import { parseFlashcardsFromFile } from "@/lib/parse-cards-file.functions";
import { BulkCoinsMeter } from "@/components/BulkCoinsMeter";
import {
  createDocumentJob,
  saveDocumentJobProgress,
  fetchActiveDocumentJob,
  discardDocumentJob,
  type DocumentJob,
  type JobCard,
} from "@/lib/bulk-jobs";
import { T, getUiLang } from "@/lib/i18n-ui";
import { FileUp, ClipboardPaste } from "lucide-react";
import { CameraCaptureDialog } from "@/components/CameraCaptureDialog";
import { saveFlashcardsAtomically } from "@/lib/flashcards-save.functions";
import { analyzeImagePilot } from "@/lib/imagepilot.functions";
import {
  ImagePilotReviewDialog,
  type ImagePilotConfirm,
} from "@/components/ImagePilotReviewDialog";
import type { ImagePilotPin } from "@/components/ImagePilotCard";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/bulk")({
  component: BulkPage,
  head: () => ({
    meta: [
      { title: "Create multiple cards simultaneously | FlashPilot" },
      { name: "description", content: "Create and import multiple FlashPilot flashcards at once." },
      { property: "og:title", content: "Create multiple cards simultaneously | FlashPilot" },
      {
        property: "og:description",
        content: "Create and import multiple FlashPilot flashcards at once.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Subject = { id: string; name: string };
type Topic = { id: string; name: string; subject_id: string; parent_id: string | null };
type Row = {
  question: string;
  answer: string;
  image?: string | null;
  generatedJobId?: string;
  generatedOutputId?: string;
  sourceVideoUrl?: string;
};

const NEW = "__new__";

async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function stableUuid(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest.slice(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function BulkPage() {
  const b = useBulkT();
  const qc = useQueryClient();
  const plan = usePlanLimit();
  const maxAiImages = plan.isAppManager || plan.hasSubscription ? 20 : 8;
  const upgrade = useUpgradeDialog();

  const [subjectSel, setSubjectSel] = useState<string>("");
  const [subjectNew, setSubjectNew] = useState("");
  const [assuntoSel, setAssuntoSel] = useState<string>("");
  const [assuntoNew, setAssuntoNew] = useState("");
  const [topicoSel, setTopicoSel] = useState<string>("");
  const [topicoNew, setTopicoNew] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { question: "", answer: "" },
    { question: "", answer: "" },
    { question: "", answer: "" },
  ]);
  const parseImagesFn = useServerFn(parseFlashcardsFromImages);
  const saveFlashcardsFn = useServerFn(saveFlashcardsAtomically);
  const saveActionIdRef = useRef<string | null>(null);
  const savePayloadSignatureRef = useRef<string | null>(null);
  const uploadedImagesRef = useRef<{
    signature: string;
    batchImagePath: string | null;
    rowImagePaths: (string | null)[];
  } | null>(null);
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [requestedCards, setRequestedCards] = useState(10);
  const [parsingImages, setParsingImages] = useState(false);
  const [imageMode, setImageMode] = useState<"text" | "pilot">("text");
  const [pilotDialog, setPilotDialog] = useState<{
    dataUrl: string;
    pins: ImagePilotPin[];
    outputIds: string[];
    jobId: string;
    subject: string | null;
    topic: string | null;
  } | null>(null);
  const [pilotSaving, setPilotSaving] = useState(false);
  const analyzeImagePilotFn = useServerFn(analyzeImagePilot);
  const [cropQueue, setCropQueue] = useState<{ name: string; dataUrl: string }[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const parseFileFn = useServerFn(parseFlashcardsFromFile);
  const transcriptFn = useServerFn(getYoutubeTranscript);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [readingVideo, setReadingVideo] = useState(false);
  const [docText, setDocText] = useState("");
  const [docFiles, setDocFiles] = useState<
    { name: string; text: string; pdf?: string; images: string[] }[]
  >([]);
  const [parsingDoc, setParsingDoc] = useState(false);
  const [docMode, setDocMode] = useState<"total" | "sections" | "sample">("total");
  const [docFocus, setDocFocus] = useState("");
  const [docProgress, setDocProgress] = useState<{
    done: number;
    total: number;
    cards: number;
    failed: number;
  } | null>(null);
  // Trabalho em andamento gravado no banco (sobrevive a quedas de conexão).
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const jobQuery = useQuery({
    queryKey: ["doc-job"],
    queryFn: fetchActiveDocumentJob,
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 5000 : false),
  });
  // Trabalhos já concluídos e salvos ficam ocultos: a tela volta zerada (inclusive no F5).
  const [hiddenJobs, setHiddenJobs] = useState<string[]>([]);
  useEffect(() => {
    try {
      setHiddenJobs(JSON.parse(localStorage.getItem("fp:bulk:hidden-jobs") || "[]"));
    } catch {
      /* ignore */
    }
  }, []);
  const hideJob = (id: string) =>
    setHiddenJobs((cur) => {
      const next = [...cur.filter((x) => x !== id), id].slice(-50);
      try {
        localStorage.setItem("fp:bulk:hidden-jobs", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  const rawJob = jobQuery.data ?? null;
  const activeJob = rawJob && !hiddenJobs.includes(rawJob.id) ? rawJob : null;
  // Sem retomada automática: se algo foi interrompido, o aluno escolhe no aviso
  // entre continuar de onde parou ou descartar e começar do zero.

  // Batch attach — aplicado a todos os flashcards criados nesta sessão
  const [batchNoteId, setBatchNoteId] = useState<string | null>(null);
  const [batchImageFile, setBatchImageFile] = useState<File | null>(null);
  const [batchImagePreview, setBatchImagePreview] = useState<string | null>(null);
  const [batchImageCategoryId, setBatchImageCategoryId] = useState<string | null>(null);
  const [batchCreatingCat, setBatchCreatingCat] = useState(false);
  const [batchNewCatName, setBatchNewCatName] = useState("");
  const [batchSavingCat, setBatchSavingCat] = useState(false);
  const [batchVideo1, setBatchVideo1] = useState<string | null>(null);
  const [batchVideo2, setBatchVideo2] = useState<string | null>(null);

  const noteCats = useQuery({
    queryKey: ["note_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_categories")
        .select("id, name, parent_id, subject_id, topic_id")
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as FlatCat[];
    },
  });
  const sortedNoteCats = flattenCategoryTree(noteCats.data ?? []);

  function handleBatchImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error(b.imageFileOnly);
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error(b.imageTooLarge);
      return;
    }
    if (batchImagePreview) URL.revokeObjectURL(batchImagePreview);
    setBatchImageFile(f);
    setBatchImagePreview(URL.createObjectURL(f));
  }
  function clearBatchImage() {
    if (batchImagePreview) URL.revokeObjectURL(batchImagePreview);
    setBatchImageFile(null);
    setBatchImagePreview(null);
  }
  async function createBatchCategory() {
    const name = batchNewCatName.trim();
    if (!name) return;
    setBatchSavingCat(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(b.notAuthenticated);
      const { data, error } = await supabase
        .from("note_categories")
        .insert({ user_id: u.user.id, name, parent_id: null })
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["note_categories"] });
      qc.invalidateQueries({ queryKey: ["notes-picker"] });
      setBatchImageCategoryId(data.id);
      setBatchCreatingCat(false);
      setBatchNewCatName("");
      toast.success(b.categoryCreated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : b.categoryCreateFailed);
    } finally {
      setBatchSavingCat(false);
    }
  }

  function mergeCards(cards: Row[], generatedJobId?: string) {
    setRows((prev) => {
      const filled = prev.filter((r) => r.question.trim() || r.answer.trim());
      const seen = new Set<string>();
      for (const card of filled) {
        const key = card.question.toLowerCase().replace(/\s+/g, " ").trim();
        if (key) seen.add(key);
      }
      const merged = [...filled];
      for (const card of cards) {
        const key = card.question.toLowerCase().replace(/\s+/g, " ").trim();
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        merged.push(generatedJobId ? { ...card, generatedJobId } : card);
      }
      return merged.length ? merged : cards;
    });
    // Rola até o botão de salvar para deixar claro que ainda é preciso clicar em "Criar".
    setTimeout(() => {
      document
        .getElementById("bulk-save-btn")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }

  async function fileToDataUrl(file: File): Promise<string> {
    // Redimensiona para no máximo 1600px no maior lado e converte em JPEG (~0.85)
    // para reduzir o payload enviado à PilotAI.
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) {
      return await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
    }
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    // JPEG não tem transparência: sem fundo branco, PNGs transparentes ficam pretos.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function handleAddImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const remaining = maxAiImages - images.length - cropQueue.length;
    if (remaining <= 0) {
      toast.error(b.maxImages);
      return;
    }
    const take = arr.slice(0, remaining);
    try {
      const converted = await Promise.all(
        take.map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) })),
      );
      setCropQueue((prev) => [...prev, ...converted]);
    } catch {
      toast.error(b.imageReadFailed);
    }
  }

  // Ctrl+V em qualquer lugar da tela: imagens da área de transferência viram fotos para OCR.
  const pasteRef = useRef(handleAddImages);
  pasteRef.current = handleAddImages;
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (!files.length) return;
      e.preventDefault();
      const dt = new DataTransfer();
      files.forEach((f, i) =>
        dt.items.add(
          new File(
            [f],
            f.name && f.name !== "image.png" ? f.name : `colada-${Date.now()}-${i}.png`,
            { type: f.type },
          ),
        ),
      );
      void pasteRef.current(dt.files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function handleCropConfirm(dataUrl: string) {
    if (editingIdx !== null) {
      setImages((prev) => prev.map((im, i) => (i === editingIdx ? { ...im, dataUrl } : im)));
      setEditingIdx(null);
      return;
    }
    const [first, ...rest] = cropQueue;
    if (!first) return;
    setImages((prev) => [...prev, { name: first.name, dataUrl }]);
    setCropQueue(rest);
  }

  function handleCropCancel() {
    if (editingIdx !== null) {
      setEditingIdx(null);
      return;
    }
    // pula sem cortar: mantém a imagem original
    const [first, ...rest] = cropQueue;
    if (first) {
      setImages((prev) => [...prev, first]);
      setCropQueue(rest);
    }
  }

  async function shrinkDataUrl(src: string): Promise<string> {
    try {
      const blob = await (await fetch(src)).blob();
      return await fileToDataUrl(new File([blob], "img", { type: blob.type || "image/png" }));
    } catch {
      return src;
    }
  }

  function htmlToTextWithImages(html: string, imgs: string[]): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("img").forEach((el) => {
      const src = el.getAttribute("src") || "";
      if (src.startsWith("data:image/")) {
        imgs.push(src);
        el.replaceWith(doc.createTextNode(`\n[Imagem ${imgs.length - 1}]\n`));
      } else el.remove();
    });
    doc.querySelectorAll("p,li,h1,h2,h3,h4,h5,h6,br,tr,div").forEach((el) => el.append("\n"));
    return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function handleDocFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      const name = f.name;
      const ext = name.split(".").pop()?.toLowerCase() || "";
      try {
        if (f.size > 40 * 1024 * 1024) {
          toast.error(T("Arquivo muito grande (máx. 40 MB)."));
          continue;
        }
        if (ext === "pdf" || f.type === "application/pdf") {
          const dataUrl = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(String(r.result));
            r.onerror = () => rej(r.error);
            r.readAsDataURL(f);
          });
          // Extrai o texto no navegador para permitir processamento via Groq (que não aceita PDF binário).
          let pdfText = "";
          try {
            const pdfjs = await import("pdfjs-dist");
            pdfjs.GlobalWorkerOptions.workerSrc = new URL(
              "pdfjs-dist/build/pdf.worker.min.mjs",
              import.meta.url,
            ).toString();
            const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
            const pages: string[] = [];
            for (let p = 1; p <= Math.min(doc.numPages, 2000); p++) {
              const page = await doc.getPage(p);
              const tc = await page.getTextContent();
              pages.push(tc.items.map((it) => ("str" in it ? it.str : "")).join(" "));
            }
            pdfText = pages
              .join("\n\n")
              .replace(/\s{2,}/g, " ")
              .trim()
              .slice(0, 800000);
          } catch {
            /* segue só com o dataUrl; o backend decide o provedor */
          }
          setDocFiles((p) => [
            ...p,
            {
              name,
              text: pdfText,
              pdf: dataUrl.replace(/^data:[^;]*;/, "data:application/pdf;"),
              images: [],
            },
          ]);
        } else if (ext === "docx") {
          const mammoth = await import("mammoth");
          const { value } = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
          const raw: string[] = [];
          const text = htmlToTextWithImages(value, raw);
          const images = await Promise.all(raw.map(shrinkDataUrl));
          setDocFiles((p) => [...p, { name, text, images }]);
        } else if (f.type.startsWith("image/")) {
          const img = await fileToDataUrl(f);
          setDocFiles((p) => [...p, { name, text: "", images: [img] }]);
        } else if (ext === "html" || ext === "htm") {
          const raw: string[] = [];
          const text = htmlToTextWithImages(await readTextFile(f), raw);
          const images = await Promise.all(raw.map(shrinkDataUrl));
          setDocFiles((p) => [...p, { name, text, images }]);
        } else {
          const text = await readTextFile(f);
          setDocFiles((p) => [...p, { name, text, images: [] }]);
        }
      } catch {
        toast.error(T("Não foi possível ler o arquivo.") + " " + name);
      }
    }
  }

  // Fatia o material em pedaços que ao PilotAI responde em poucos segundos, sempre
  // cortando em fim de parágrafo/frase. Assim nenhuma chamada chega perto do
  // limite de tempo da rede (erro 524) e o usuário não precisa dividir nada.
  function splitForAi(text: string, size = 16000): string[] {
    if (text.length <= size) return [text];
    const out: string[] = [];
    let rest = text;
    while (rest.length > size) {
      let cut = rest.lastIndexOf("\n\n", size);
      if (cut < size * 0.5) cut = rest.lastIndexOf(". ", size);
      if (cut < size * 0.5) cut = size;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1);
    }
    if (rest.trim()) out.push(rest.trim());
    return out.filter(Boolean);
  }

  function capAiParts(parts: string[], maxParts: number): string[] {
    if (parts.length <= maxParts) return parts;
    const groups = Array.from({ length: maxParts }, () => [] as string[]);
    parts.forEach((part, index) => {
      groups[Math.floor((index * maxParts) / parts.length)]!.push(part);
    });
    return groups.map((group) => group.join("\n\n"));
  }

  type Out = JobCard;

  /**
   * Processa (ou retoma) um trabalho já registrado no banco. Cada parte concluída
   * é gravada na hora, então uma queda de conexão, um travamento do computador ou
   * fechar a aba não perdem nada: ao voltar à tela o trabalho continua de onde parou.
   */
  async function runDocumentJob(
    job: DocumentJob,
    imgs: string[],
    pdf?: { filename: string; dataUrl: string },
  ) {
    setParsingDoc(true);
    setRunningJobId(job.id);
    const collected: Out[] = [...job.result_cards];
    const remaining = [...job.input_slices];
    const total = job.total_parts;
    let done = job.processed_parts;
    let failed = job.failed_parts;
    let firstError: unknown = null;
    let firstErrorMessage: string | null = null;
    setDocProgress({ done, total, cards: collected.length, failed });

    const persist = () =>
      saveDocumentJobProgress(job.id, {
        processed_parts: done,
        failed_parts: failed,
        cards: collected,
        remaining_slices: remaining,
      });

    async function runOne(
      slice: string | null,
      includeImages: boolean,
      ordinal: number,
    ): Promise<boolean> {
      let cards: Out[] | null = null;
      const inputKey = slice === null ? "<image-job>" : await sha256(slice);
      const actionId = await stableUuid(`${job.id}\n${ordinal}\n${inputKey}`);
      const cardsPerPart = Math.floor(job.requested_cards / job.total_parts);
      const extraCards = job.requested_cards % job.total_parts;
      const requestedCardsForPart = cardsPerPart + (ordinal < extraCards ? 1 : 0);
      try {
        const result = await parseFileFn({
          data: {
            actionId,
            jobId: job.id,
            requestedCards: requestedCardsForPart,
            text: slice ?? "",
            images: slice === null || includeImages ? imgs : [],
            hint: job.hint ?? "",
            pdf: slice === null && pdf ? pdf : undefined,
            mode: (job.mode as "total" | "sections" | "sample") ?? "total",
            focus: job.focus ?? undefined,
          },
        });
        cards = result.cards;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        failed += 1;
        firstError ??= e;
        firstErrorMessage ??= msg;
        setDocProgress({ done, total, cards: collected.length, failed });
        await persist();
        return false;
      }

      if (!cards) return false;
      collected.push(...cards);
      done += 1;
      if (slice !== null) {
        const at = remaining.indexOf(slice);
        if (at >= 0) remaining.splice(at, 1);
      }
      setDocProgress({ done, total, cards: collected.length, failed });
      await persist();
      return true;
    }

    try {
      if (!remaining.length) {
        // PDF digitalizado / só imagens: uma única chamada.
        if (done < total) await runOne(null, true, done);
      } else {
        // Só avança após salvar cada fatia para manter ordinais estáveis em retries.
        while (remaining.length > 0) {
          if (!(await runOne(remaining[0]!, done === 0, done))) break;
        }
      }

      // Une tudo e remove perguntas repetidas entre as partes.
      const seen = new Set<string>();
      const merged = collected.filter((c) => {
        const key = c.question.toLowerCase().replace(/\s+/g, " ").trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (remaining.length === 0) failed = 0;
      await saveDocumentJobProgress(job.id, {
        processed_parts: done,
        failed_parts: failed,
        cards: collected,
        remaining_slices: remaining,
        status: remaining.length ? "failed" : merged.length ? "completed" : "failed",
        error_message: remaining.length || !merged.length ? firstErrorMessage : null,
      });

      if (!merged.length) {
        if (firstError && friendlyAiError(firstError).store) toastAiError(firstError);
        else toast.error(firstErrorMessage || b.noCardsFromText);
        return;
      }
      if (firstError && friendlyAiError(firstError).store) {
        toastAiError(firstError, { persistent: true });
      }
      loadJobCards(job.id, merged, imgs, job.hint);
      if (remaining.length > 0) {
        toast.warning(
          T(
            "Algumas partes do documento ainda precisam ser processadas. Os flashcards concluídos foram carregados para revisão.",
          ),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : b.aiProcessFailed;
      try {
        await saveDocumentJobProgress(job.id, { status: "failed", error_message: msg });
      } catch (saveError) {
        console.error("Failed to persist document job error", saveError);
      }
      toast.error(msg);
    } finally {
      setParsingDoc(false);
      setRunningJobId(null);
      setDocProgress(null);
      jobQuery.refetch();
    }
  }

  /** Coloca os flashcards gerados na lista de revisão e preserva a cópia recuperável. */
  function loadJobCards(jobId: string, cards: Out[], imgs: string[], hint?: string | null) {
    const sourceVideoUrl = hint?.startsWith("YouTube source: ")
      ? canonicalYoutubeUrl(hint.slice("YouTube source: ".length)) ?? undefined : undefined;
    mergeCards(
      cards.map((c) => ({
        question: c.question,
        answer: c.answer,
        image: c.image_index != null ? (imgs[c.image_index] ?? null) : null,
        generatedOutputId: c.generatedOutputId,
        sourceVideoUrl,
      })),
      jobId,
    );
    void qc.invalidateQueries({ queryKey: ["account-overview"] });
    void qc.invalidateQueries({ queryKey: ["flashcoins"] });
    setDocFiles([]);
    setDocText("");
    toast.success(b.textReady(cards.length));
  }

  async function handleDiscardJob(jobId: string) {
    try {
      await discardDocumentJob(jobId);
      await jobQuery.refetch();
    } catch (error) {
      console.error("Failed to discard document job", error);
      toast.error(T("Não foi possível descartar o processamento."));
    }
  }

  async function handleParseDoc() {
    if (!plan.canUseAI) return toast.error(b.proOnly);
    const pdfs = docFiles.filter((d) => d.pdf);
    if (pdfs.length > 1) return toast.error(T("Envie um PDF por vez."));
    // Renumera imagens globalmente e monta o texto final.
    const allImages: string[] = [];
    const parts: string[] = [];
    if (docText.trim()) parts.push(docText.trim());
    for (const d of docFiles) {
      const offset = allImages.length;
      allImages.push(...d.images);
      let t = d.text.replace(/\[Imagem (\d+)\]/g, (_, n) => `[Imagem ${Number(n) + offset}]`);
      if (!d.text && d.images.length && !d.pdf) t = `[Imagem ${offset}]`;
      if (t) parts.push(`--- ${d.name} ---\n${t}`);
    }
    if (allImages.length > maxAiImages) {
      toast.warning(T("Apenas as primeiras {n} imagens serão analisadas.", { n: maxAiImages }));
    }
    const images = allImages.slice(0, maxAiImages);
    const text = parts.join("\n\n");
    if (!text && !pdfs.length && !images.length)
      return toast.error(T("Envie um texto, arquivo ou imagem."));
    const hint =
      (subjectSel && subjectSel !== NEW
        ? (subjects.data ?? []).find((s) => s.id === subjectSel)?.name
        : subjectNew) || "";

    if (docMode === "sections" && !docFocus.trim())
      return toast.error(T("Informe os capítulos ou seções desejados."));
    // Cobertura total/seções: fatias menores para ao PilotAI conseguir tratar item por item.
    const maxTextChars = plan.isAppManager || plan.hasSubscription ? 150_000 : 30_000;
    const maxParts = plan.isAppManager || plan.hasSubscription ? 10 : 4;
    const targetPartSize = Math.ceil(maxTextChars / maxParts);
    const slices = text
      ? splitForAi(text, docMode === "sample" ? Math.max(targetPartSize, 16_000) : targetPartSize)
      : [];
    const boundedSlices = capAiParts(slices, maxParts);
    const total = Math.max(boundedSlices.length, 1);
    if (requestedCards < total) {
      return toast.error(
        T("A quantidade desejada precisa ser pelo menos igual ao número de partes ({n}).", {
          n: total,
        }),
      );
    }

    let job: DocumentJob;
    try {
      job = await createDocumentJob({
        actionId: crypto.randomUUID(),
        documentName: docFiles[0]?.name || T("Texto enviado"),
        mode: docMode,
        totalParts: total,
        requestedCards,
        slices: boundedSlices,
        images,
        hint,
        focus: docMode === "sections" ? docFocus.trim() : undefined,
      });
    } catch (error) {
      return toast.error(error instanceof Error ? error.message : b.aiProcessFailed);
    }
    jobQuery.refetch();
    await runDocumentJob(
      job,
      images,
      pdfs[0]?.pdf ? { filename: pdfs[0].name, dataUrl: pdfs[0].pdf } : undefined,
    );
  }

  async function handleParseVideo() {
    if (!plan.canUseAI || readingVideo || parsingDoc) return;
    setReadingVideo(true);
    try {
      const transcript = await transcriptFn({ data: { url: youtubeUrl, lang: getUiLang() } });
      const maxChars = plan.isAppManager || plan.hasSubscription ? 150_000 : 30_000;
      if (transcript.text.length > maxChars) throw new Error("YOUTUBE_TOO_LONG");
      const slices = capAiParts(splitForAi(transcript.text), Math.min(requestedCards, plan.hasSubscription || plan.isAppManager ? 10 : 4));
      const job = await createDocumentJob({
        actionId: crypto.randomUUID(), documentName: transcript.title,
        mode: docMode, requestedCards, totalParts: slices.length,
        slices, images: [], hint: `YouTube source: ${transcript.url}`,
        focus: docMode === "sections" ? docFocus.trim() : undefined,
      });
      await runDocumentJob(job, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message.includes("YOUTUBE_") ? youtubeErrorMessage(error) : friendlyAiError(error).text);
    } finally { setReadingVideo(false); }
  }

  async function handleParseImages() {
    if (!plan.canUseAI) return toast.error(b.proOnly);
    if (images.length === 0) return toast.error(b.addPhotoFirst);
    setParsingImages(true);
    let jobIdForFailure: string | null = null;
    try {
      const hint =
        (subjectSel && subjectSel !== NEW
          ? (subjects.data ?? []).find((s) => s.id === subjectSel)?.name
          : subjectNew) || "";
      const actionId = crypto.randomUUID();
      const job = await createDocumentJob({
        actionId,
        documentName: T("Fotos enviadas"),
        mode: "total",
        totalParts: 1,
        requestedCards,
        slices: [],
        images: images.map((i) => i.dataUrl),
        hint,
      });
      jobIdForFailure = job.id;
      const { cards } = await parseImagesFn({
        data: {
          actionId,
          jobId: job.id,
          requestedCards,
          images: images.map((i) => i.dataUrl),
          hint,
        },
      });
      await saveDocumentJobProgress(job.id, {
        processed_parts: 1,
        failed_parts: 0,
        cards: cards.map((card) => ({ ...card, image_index: null })),
        remaining_slices: [],
        status: cards.length ? "completed" : "failed",
      });
      if (!cards.length) {
        toast.error(b.noCardsFromImages);
        return;
      }
      mergeCards(cards, job.id);
      void qc.invalidateQueries({ queryKey: ["account-overview"] });
      void qc.invalidateQueries({ queryKey: ["flashcoins"] });
      setImages([]);
      toast.success(b.imagesReady(cards.length));
    } catch (e) {
      const message = e instanceof Error ? e.message : b.imageProcessFailed;
      if (jobIdForFailure) {
        try {
          await saveDocumentJobProgress(jobIdForFailure, {
            status: "failed",
            error_message: message,
          });
        } catch (saveError) {
          console.error("Failed to persist image job error", saveError);
        }
      }
      if (friendlyAiError(e).store) toastAiError(e);
      else toast.error(message);
    } finally {
      setParsingImages(false);
    }
  }

  // ImagePilot: a própria imagem vira a frente do flashcard, com marcadores numerados.
  async function handleImagePilot() {
    if (!plan.canUseAI) return toast.error(b.proOnly);
    if (images.length !== 1) return toast.error(b.imagePilotNeedOne);
    setParsingImages(true);
    let jobIdForFailure: string | null = null;
    try {
      const hint =
        (subjectSel && subjectSel !== NEW
          ? (subjects.data ?? []).find((s) => s.id === subjectSel)?.name
          : subjectNew) || "";
      const actionId = crypto.randomUUID();
      const job = await createDocumentJob({
        actionId,
        documentName: T("Imagem ImagePilot"),
        mode: "total",
        totalParts: 1,
        requestedCards: 30,
        slices: [],
        images: [images[0].dataUrl],
        hint,
      });
      jobIdForFailure = job.id;
      const result = await analyzeImagePilotFn({
        data: {
          actionId,
          jobId: job.id,
          image: images[0].dataUrl,
          hint,
          lang: getUiLang(),
        },
      });
      if (!result.pins.length) {
        await saveDocumentJobProgress(job.id, {
          processed_parts: 1,
          failed_parts: 0,
          cards: [],
          remaining_slices: [],
          status: "completed",
        });
        // Sem estruturas: a imagem acompanha o card e o PilotAI cria perguntas
        // sobre o texto/conteúdo da imagem.
        const fbActionId = crypto.randomUUID();
        const fbJob = await createDocumentJob({
          actionId: fbActionId,
          documentName: T("Fotos enviadas"),
          mode: "total",
          totalParts: 1,
          requestedCards,
          slices: [],
          images: [images[0].dataUrl],
          hint,
        });
        jobIdForFailure = fbJob.id;
        const { cards } = await parseImagesFn({
          data: { actionId: fbActionId, jobId: fbJob.id, requestedCards, images: [images[0].dataUrl], hint },
        });
        await saveDocumentJobProgress(fbJob.id, {
          processed_parts: 1,
          failed_parts: 0,
          cards: cards.map((card) => ({ ...card, image_index: 0 })),
          remaining_slices: [],
          status: cards.length ? "completed" : "failed",
        });
        if (!cards.length) {
          toast.error(b.noCardsFromImages);
          return;
        }
        mergeCards(cards.map((c) => ({ ...c, image: images[0].dataUrl })), fbJob.id);
        void qc.invalidateQueries({ queryKey: ["account-overview"] });
        void qc.invalidateQueries({ queryKey: ["flashcoins"] });
        return;
      }
      setPilotDialog({
        dataUrl: images[0].dataUrl,
        pins: result.pins,
        outputIds: result.outputIds,
        jobId: job.id,
        subject: result.subject,
        topic: result.topic,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : b.imagePilotFailed;
      if (jobIdForFailure) {
        try {
          await saveDocumentJobProgress(jobIdForFailure, {
            status: "failed",
            error_message: message,
          });
        } catch (saveError) {
          console.error("Failed to persist ImagePilot job error", saveError);
        }
      }
      if (friendlyAiError(e).store) toastAiError(e);
      else toast.error(message);
    } finally {
      setParsingImages(false);
    }
  }

  async function handlePilotConfirm(result: ImagePilotConfirm) {
    if (!pilotDialog) return;
    setPilotSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(b.notAuthenticated);
      const userId = u.user.id;

      // Resolve a matéria pelo nome (reutiliza uma existente com o mesmo nome).
      let subjectId: string;
      const { data: foundSubject, error: findSubjectErr } = await supabase
        .from("subjects")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", result.subjectName)
        .maybeSingle();
      if (findSubjectErr) throw findSubjectErr;
      if (foundSubject) {
        subjectId = foundSubject.id;
      } else {
        const { data: created, error } = await supabase
          .from("subjects")
          .insert({ user_id: userId, name: result.subjectName })
          .select("id")
          .single();
        if (error) throw error;
        subjectId = created.id;
      }

      // Resolve o assunto pelo nome sob a matéria (mesma regra de dedup do salvamento manual).
      let assuntoId: string;
      const { data: foundTopic, error: findTopicErr } = await supabase
        .from("topics")
        .select("id")
        .eq("subject_id", subjectId)
        .is("parent_id", null)
        .ilike("name", result.topicName)
        .maybeSingle();
      if (findTopicErr) throw findTopicErr;
      if (foundTopic) {
        assuntoId = foundTopic.id;
      } else {
        const { data: created, error } = await supabase
          .from("topics")
          .insert({ user_id: userId, subject_id: subjectId, parent_id: null, name: result.topicName })
          .select("id")
          .single();
        if (error) throw error;
        assuntoId = created.id;
      }

      // Sobe a imagem para o armazenamento (mesmo bucket das imagens de flashcards).
      const blob = await (await fetch(pilotDialog.dataUrl)).blob();
      const file = new File([blob], `imagepilot-${Date.now()}.png`, {
        type: blob.type || "image/png",
      });
      const imagePath = await uploadMindMapImage(file, null);

      const legend = result.pins.map((p) => `${p.n} – ${p.label}`).join("\n");
      const firstGeneratedOutputId = result.generatedOutputIds.find(
        (outputId): outputId is string => Boolean(outputId),
      );
      const cards =
        result.mode === "single"
          ? [
              {
                topicId: assuntoId,
                question: T("Identifique os itens numerados na imagem."),
                answer: legend,
                cardFormat: "imagepilot",
                imageUrl: imagePath,
                imagePins: result.pins,
                imageFocus: null,
                generatedJobId: firstGeneratedOutputId ? pilotDialog.jobId : undefined,
                generatedOutputId: firstGeneratedOutputId,
              },
            ]
          : result.pins.map((p, i) => ({
              topicId: assuntoId,
              question: T("Qual é o item nº {n} na imagem?", { n: p.n }),
              answer: p.label,
              cardFormat: "imagepilot",
              imageUrl: imagePath,
              imagePins: result.pins,
              imageFocus: p.n,
              generatedJobId: result.generatedOutputIds[i] ? pilotDialog.jobId : undefined,
              generatedOutputId: result.generatedOutputIds[i] ?? undefined,
            }));

      await saveFlashcardsFn({ data: { actionId: crypto.randomUUID(), cards } });
      await saveDocumentJobProgress(pilotDialog.jobId, {
        processed_parts: 1,
        failed_parts: 0,
        cards: [],
        remaining_slices: [],
        status: "completed",
      });
      setPilotDialog(null);
      setImages([]);
      void qc.invalidateQueries({ queryKey: ["account-overview"] });
      void qc.invalidateQueries({ queryKey: ["flashcoins"] });
      void qc.invalidateQueries({ queryKey: ["subjects"] });
      void qc.invalidateQueries({ queryKey: ["topics"] });
      void qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      toast.success(b.imagePilotSaved(cards.length));
    } catch (e) {
      if (friendlyAiError(e).store) toastAiError(e);
      else toast.error(e instanceof Error ? e.message : b.genericError);
    } finally {
      setPilotSaving(false);
    }
  }

  async function handlePilotCancel() {
    if (pilotDialog) {
      try {
        await discardDocumentJob(pilotDialog.jobId);
        await jobQuery.refetch();
      } catch (error) {
        console.error("Failed to discard ImagePilot job", error);
      }
    }
    setPilotDialog(null);
  }

  function parseCsv(text: string): Row[] {
    // Remove BOM
    const src = text.replace(/^\uFEFF/, "");
    // Detect delimiter: prefer ';' if it appears more than ',' on the first non-empty line
    const firstLine = src.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
    const semi = (firstLine.match(/;/g) ?? []).length;
    const comma = (firstLine.match(/,/g) ?? []).length;
    const tab = (firstLine.match(/\t/g) ?? []).length;
    const delim = tab > 0 && tab >= semi && tab >= comma ? "\t" : semi > comma ? ";" : ",";

    const rowsOut: string[][] = [];
    let field = "";
    let row: string[] = [];
    let inQuotes = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQuotes) {
        if (ch === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === delim) {
          row.push(field);
          field = "";
        } else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && src[i + 1] === "\n") i++;
          row.push(field);
          field = "";
          rowsOut.push(row);
          row = [];
        } else field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rowsOut.push(row);
    }

    // Skip header if first row looks like ("pergunta","resposta")
    const cards: Row[] = [];
    let start = 0;
    if (rowsOut.length > 0) {
      const [a, b] = rowsOut[0];
      const na = (a ?? "").trim().toLowerCase();
      const nb = (b ?? "").trim().toLowerCase();
      const isHeader =
        ["pergunta", "question", "q", "front"].includes(na) &&
        ["resposta", "answer", "a", "back"].includes(nb);
      if (isHeader) start = 1;
    }
    for (let i = start; i < rowsOut.length; i++) {
      const [q, a] = rowsOut[i];
      const question = (q ?? "").trim();
      const answer = (a ?? "").trim();
      if (!question && !answer) continue;
      cards.push({ question, answer });
    }
    return cards;
  }

  async function handleCsvFile(file: File | null | undefined) {
    if (!file) return;
    try {
      const text = await readTextFile(file);
      const cards = parseCsv(text);
      if (!cards.length) {
        toast.error(b.noCardsCsv);
        return;
      }
      mergeCards(cards);
      toast.success(b.csvReady(cards.length));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : b.csvReadFailed);
    }
  }

  const subjects = useQuery({
    queryKey: ["bulk-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  const topics = useQuery({
    queryKey: ["bulk-topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, article_range, subject_id, parent_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Topic[];
    },
  });

  // Assunto: qualquer nível da matéria (assunto, subtópico, subitem…)
  const assuntoOptions = useMemo(() => {
    if (!subjectSel || subjectSel === NEW) return [];
    return flattenTopicTree((topics.data ?? []).filter((t) => t.subject_id === subjectSel));
  }, [topics.data, subjectSel]);

  // Nível abaixo: todos os descendentes do item escolhido.
  const topicoOptions = useMemo(() => {
    if (!assuntoSel || assuntoSel === NEW) return [];
    const rows = topics.data ?? [];
    const desc = descendantsOf(rows, assuntoSel);
    desc.delete(assuntoSel);
    return flattenTopicTree(rows.filter((t) => desc.has(t.id)));
  }, [topics.data, assuntoSel]);

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { question: "", answer: "" }]);
  }
  function addManyRows(n: number) {
    setRows((prev) => [
      ...prev,
      ...Array.from({ length: n }, () => ({ question: "", answer: "" })),
    ]);
  }
  function removeRow(i: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  const submit = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(b.notAuthenticated);
      const userId = u.user.id;

      // Validate
      const validRows = rows
        .map((r) => ({
          question: r.question.trim(),
          answer: r.answer.trim(),
          image: r.image ?? null,
          generatedJobId: r.generatedJobId,
          generatedOutputId: r.generatedOutputId,
          sourceVideoUrl: r.sourceVideoUrl,
        }))
        .filter((r) => r.question.length > 0);
      if (validRows.length === 0) throw new Error(b.addQuestion);

      if (!plan.canUseBulk) {
        upgrade.show();
        throw new Error("LIMIT");
      }
      if (!plan.canCreate(validRows.length)) {
        upgrade.show();
        throw new Error("LIMIT");
      }

      // Resolve subject
      let subjectId = subjectSel;
      if (!subjectId) throw new Error(b.selectSubject);
      if (subjectId === NEW) {
        const name = subjectNew.trim();
        if (!name) throw new Error(b.subjectNameRequired);
        const { data, error } = await supabase
          .from("subjects")
          .insert({ user_id: userId, name })
          .select("id")
          .single();
        if (error) throw error;
        subjectId = data.id;
      }

      // Resolve assunto (topic with parent_id null). Obrigatório: o aluno
      // escolhe um assunto existente ou cria um novo ao criar flashcards.
      let assuntoId = assuntoSel;
      if (assuntoId === NEW) {
        const name = assuntoNew.trim();
        if (!name) throw new Error(b.topicNameRequired);
        // Dedup: reutiliza assunto existente com o mesmo nome sob a matéria (evita duplicatas)
        const { data: found, error: findErr } = await supabase
          .from("topics")
          .select("id")
          .eq("subject_id", subjectId)
          .is("parent_id", null)
          .ilike("name", name)
          .maybeSingle();
        if (findErr) throw findErr;
        if (found) {
          assuntoId = found.id;
        } else {
          const { data, error } = await supabase
            .from("topics")
            .insert({ user_id: userId, subject_id: subjectId, parent_id: null, name })
            .select("id")
            .single();
          if (error) throw error;
          assuntoId = data.id;
        }
      } else if (!assuntoId) {
        throw new Error(b.selectAssunto);
      }

      // Resolve tópico (child of assunto). Optional — if none, cards go under assunto.
      let topicoId = topicoSel;
      if (topicoId === NEW) {
        const name = topicoNew.trim();
        if (!name) throw new Error(b.subtopicNameRequired);
        // Dedup: reutiliza tópico existente com o mesmo nome sob o assunto
        const { data: found, error: findErr } = await supabase
          .from("topics")
          .select("id")
          .eq("parent_id", assuntoId)
          .ilike("name", name)
          .maybeSingle();
        if (findErr) throw findErr;
        if (found) {
          topicoId = found.id;
        } else {
          const { data, error } = await supabase
            .from("topics")
            .insert({ user_id: userId, subject_id: subjectId, parent_id: assuntoId, name })
            .select("id")
            .single();
          if (error) throw error;
          topicoId = data.id;
        }
      }

      const finalTopicId = topicoId && topicoId !== "" ? topicoId : assuntoId;

      const [batchImageHash, rowImageHashes] = await Promise.all([
        batchImageFile ? sha256(await batchImageFile.arrayBuffer()) : null,
        Promise.all(validRows.map((row) => (row.image ? sha256(row.image) : null))),
      ]);
      const savePayloadSignature = JSON.stringify({
        topicId: finalTopicId,
        cards: validRows.map((row, index) => ({
          question: row.question,
          answer: row.answer,
          imageHash: rowImageHashes[index],
          generatedJobId: row.generatedJobId ?? null,
          generatedOutputId: row.generatedOutputId ?? null,
          sourceVideoUrl: row.sourceVideoUrl ?? null,
        })),
        batchImageHash,
        batchImageCategoryId,
        batchNoteId,
        batchVideo1,
        batchVideo2,
      });
      if (savePayloadSignatureRef.current !== savePayloadSignature) {
        saveActionIdRef.current = crypto.randomUUID();
        savePayloadSignatureRef.current = savePayloadSignature;
        uploadedImagesRef.current = null;
      }

      let uploadedImages = uploadedImagesRef.current;
      if (!uploadedImages) {
        let batchImagePath: string | null = null;
        if (batchImageFile) {
          batchImagePath = await uploadMindMapImage(batchImageFile, batchImageCategoryId);
        }

        const rowImagePaths = await Promise.all(
          validRows.map(async (row) => {
            if (!row.image) return null;
            const blob = await (await fetch(row.image)).blob();
            return uploadMindMapImage(
              new File([blob], "card.jpg", { type: blob.type || "image/jpeg" }),
              null,
            );
          }),
        );
        uploadedImages = { signature: savePayloadSignature, batchImagePath, rowImagePaths };
        uploadedImagesRef.current = uploadedImages;
      }
      if (uploadedImages.signature !== savePayloadSignature) {
        throw new Error("O conteúdo mudou durante o salvamento. Tente novamente.");
      }

      const { batchImagePath, rowImagePaths } = uploadedImages;
      const payload = validRows.map((r, idx) => ({
        user_id: userId,
        topic_id: finalTopicId,
        question: r.question,
        answer: r.answer,
        order_index: extractOrderFromText(r.answer) ?? extractOrderFromText(r.question),
        linked_note_id: batchNoteId,
        image_url: rowImagePaths[idx] ?? batchImagePath,
        image_category_id: rowImagePaths[idx] ? null : batchImagePath ? batchImageCategoryId : null,
        video_url_1: r.sourceVideoUrl ?? batchVideo1,
        video_url_2: batchVideo2,
      }));

      setSaveProgress({ done: 0, total: payload.length });
      try {
        const saved = await saveFlashcardsFn({
          data: {
            actionId: saveActionIdRef.current!,
            cards: payload.map((card, index) => ({
              topicId: finalTopicId,
              question: card.question,
              answer: card.answer,
              orderIndex: card.order_index,
              linkedNoteId: card.linked_note_id,
              imageUrl: card.image_url,
              imageCategoryId: card.image_category_id,
              videoUrl1: card.video_url_1,
              videoUrl2: card.video_url_2,
              generatedJobId: validRows[index]?.generatedJobId ?? null,
              generatedOutputId: validRows[index]?.generatedOutputId ?? null,
            })),
          },
        });
        setSaveProgress({ done: payload.length, total: payload.length });
        return saved;
      } finally {
        setSaveProgress(null);
      }
    },
    onSuccess: (saved) => {
      if (activeJob?.status === "completed") hideJob(activeJob.id);
      saveActionIdRef.current = null;
      savePayloadSignatureRef.current = null;
      uploadedImagesRef.current = null;
      toast.success(b.created(saved.insertedCount));
      if (saved.chargedCoins > 0) {
        toast.info(
          T("Concluído com {coins} FlashCoins debitadas. Saldo disponível: {balance}.", {
            coins: saved.chargedCoins,
            balance: saved.balance.toLocaleString(),
          }),
        );
      }
      qc.invalidateQueries({ queryKey: ["ai-billing"] });
      setRows([
        { question: "", answer: "" },
        { question: "", answer: "" },
        { question: "", answer: "" },
      ]);
      clearBatchImage();
      setBatchImageCategoryId(null);
      setBatchNoteId(null);
      setBatchVideo1(null);
      setBatchVideo2(null);

      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
      qc.invalidateQueries({ queryKey: ["due-today"] });
      qc.invalidateQueries({ queryKey: ["bulk-subjects"] });
      qc.invalidateQueries({ queryKey: ["bulk-topics"] });
      qc.invalidateQueries({ queryKey: ["topic-counts"] });
      qc.invalidateQueries({ queryKey: ["account-overview"] });
      qc.invalidateQueries({ queryKey: ["flashcoins"] });
      void jobQuery.refetch();
    },
    onError: (e) => {
      if ((e as Error).message !== "LIMIT")
        toastAiError(e);
    },
  });

  if (plan.loading) {
    return <div className="text-sm text-muted-foreground">{b.loading}</div>;
  }

  const validCount = rows.filter((r) => r.question.trim().length > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/home">
              <ArrowLeft className="h-4 w-4 mr-1" /> {b.back}
            </Link>
          </Button>
          <div>
            <h1 className="font-serif text-2xl flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" /> {b.title}
            </h1>
            <p className="text-sm text-muted-foreground">{b.subtitle}</p>
          </div>
        </div>
        {plan.isAppManager && (
          <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-medium">
            AppManager
          </span>
        )}
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{b.subject}</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={subjectSel}
              onChange={(e) => {
                setSubjectSel(e.target.value);
                setAssuntoSel("");
                setTopicoSel("");
              }}
            >
              <option value="">{b.select}</option>
              {(subjects.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={NEW}>{b.newSubject}</option>
            </select>
            {subjectSel === NEW && (
              <Input
                placeholder={b.subjectName}
                value={subjectNew}
                onChange={(e) => setSubjectNew(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>
              {b.topic}{" "}
              <span className="text-muted-foreground text-xs">({b.topicRequired})</span>
            </Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              value={assuntoSel}
              disabled={!subjectSel}
              onChange={(e) => {
                setAssuntoSel(e.target.value);
                setTopicoSel("");
              }}
            >
              <option value="">{b.select}</option>
              {assuntoOptions.map((t) => (
                <option key={t.id} value={t.id} title={t.path}>
                  {indentTopicLabel(t)}
                </option>
              ))}

              <option value={NEW}>{b.newTopic}</option>
            </select>
            {assuntoSel === NEW && (
              <Input
                placeholder={b.topicName}
                value={assuntoNew}
                onChange={(e) => setAssuntoNew(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>
              {b.subtopic}{" "}
              <span className="text-muted-foreground text-xs">({b.subtopicOptional})</span>
            </Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              value={topicoSel}
              disabled={!assuntoSel || assuntoSel === NEW}
              onChange={(e) => setTopicoSel(e.target.value)}
            >
              <option value="">({b.noSubtopic})</option>
              {topicoOptions.map((t) => (
                <option key={t.id} value={t.id} title={t.path}>
                  {indentTopicLabel(t)}
                </option>
              ))}

              <option value={NEW}>{b.newSubtopic}</option>
            </select>
            {topicoSel === NEW && (
              <Input
                placeholder={b.subtopicName}
                value={topicoNew}
                onChange={(e) => setTopicoNew(e.target.value)}
              />
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 space-y-4 border-primary/30">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-primary" />
          <h2 className="font-medium">{b.attachTitle}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{b.attachDescription}</p>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Nota */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> {b.noteOptional}
            </label>
            <NoteLinkPicker value={batchNoteId} onChange={setBatchNoteId} />
          </div>

          {/* Imagem */}
          <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/30">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" /> {b.imageOptional}
            </label>

            {batchImagePreview && (
              <div className="relative rounded-lg overflow-hidden border border-border bg-background">
                <img
                  src={batchImagePreview}
                  alt={b.preview}
                  className="w-full max-h-48 object-contain select-none pointer-events-none"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-1 right-1 h-7 px-2"
                  onClick={clearBatchImage}
                >
                  <X className="h-3 w-3 mr-1" /> {b.remove}
                </Button>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select
                value={batchImageCategoryId ?? "__none__"}
                onValueChange={(v) => setBatchImageCategoryId(v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={b.categoryOptional} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{b.noCategory}</SelectItem>
                  {sortedNoteCats.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{b.categories}</SelectLabel>
                      {sortedNoteCats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {indentLabel(c)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBatchCreatingCat((v) => !v)}
              >
                <FolderPlus className="h-4 w-4 mr-1" /> {b.new}
              </Button>
            </div>

            {batchCreatingCat && (
              <div className="flex items-center gap-2">
                <Input
                  value={batchNewCatName}
                  onChange={(e) => setBatchNewCatName(e.target.value)}
                  placeholder={b.newCategoryName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      createBatchCategory();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={createBatchCategory}
                  disabled={batchSavingCat || !batchNewCatName.trim()}
                >
                  {batchSavingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : b.create}
                </Button>
              </div>
            )}

            <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBatchImageFile}
              />
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 hover:bg-muted">
                <Upload className="h-4 w-4" />
                {batchImageFile ? b.changeImage : b.chooseImage}
              </span>
              {batchImageFile && (
                <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {batchImageFile.name}
                </span>
              )}
            </label>
          </div>
        </div>

        {/* Vídeos */}
        <div className="rounded-xl border border-border p-3 bg-muted/30">
          <VideoLinksPicker
            video1={batchVideo1}
            video2={batchVideo2}
            onChange={({ video1, video2 }) => {
              setBatchVideo1(video1);
              setBatchVideo2(video2);
            }}
          />
        </div>
      </Card>

      <section className="space-y-3 border-y border-border py-4">
        <h2 className="font-medium">YouTube</h2>
        <YouTubeSourceInput value={youtubeUrl} onChange={setYoutubeUrl} disabled={readingVideo || parsingDoc} />
        <Button type="button" onClick={() => void handleParseVideo()} disabled={!plan.canUseAI || !youtubeUrl.trim() || readingVideo || parsingDoc}>
          {readingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {T("Gerar com o PilotAI")}
        </Button>
      </section>

      {!plan.canUseAI ? (
        <ProFeatureCard
          icon={<FileUp className="h-5 w-5 text-primary" />}
          title={T("Enviar arquivo ou texto (com ou sem imagens)")}
          description={T(
            "Envie PDF, Word (.docx), TXT, HTML ou imagens, ou cole um texto. O PilotAI cria os flashcards e, quando uma imagem do material tiver relação com o assunto, cria cards com a imagem.",
          )}
          copy={b}
        />
      ) : (
        <Card className="p-4 sm:p-6 space-y-3 border-primary/30">
          <div className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            <h2 className="font-medium">{T("Enviar arquivo ou texto (com ou sem imagens)")}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {T(
              "Envie PDF, Word (.docx), TXT, HTML ou imagens, ou cole um texto. O PilotAI cria os flashcards e, quando uma imagem do material tiver relação com o assunto, cria cards com a imagem.",
            )}
          </p>
          <Textarea
            rows={4}
            value={docText}
            onChange={(e) => setDocText(e.target.value)}
            placeholder={T("Texto opcional…")}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.html,.htm,application/pdf,text/plain,image/*"
                className="hidden"
                onChange={(e) => {
                  handleDocFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">
                <FileUp className="h-4 w-4" /> {T("Escolher arquivos")}
              </span>
            </label>
            {docFiles.map((d, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs rounded-full border border-border px-2 py-1"
              >
                {d.name}
                {d.images.length ? ` · ${d.images.length} img` : ""}
                <button
                  type="button"
                  aria-label={b.remove}
                  onClick={() => setDocFiles((p) => p.filter((_, j) => j !== i))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{T("O que transformar em flashcards?")}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  [
                    "total",
                    T("Tudo, sem exceção"),
                    T("Cada artigo, enunciado e conceito vira flashcard."),
                  ],
                  [
                    "sections",
                    T("Capítulos que eu escolher"),
                    T("Você indica as partes prioritárias; elas são tratadas por completo."),
                  ],
                  ["sample", T("Amostra relevante"), T("O PilotAI seleciona os pontos principais.")],
                ] as const
              ).map(([v, title, desc]) => (
                <button
                  key={v}
                  type="button"
                  disabled={parsingDoc}
                  onClick={() => setDocMode(v)}
                  className={`text-left rounded-lg border p-3 text-sm transition ${docMode === v ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
                >
                  <span className="font-medium block">{title}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
            {docMode === "sections" && (
              <Textarea
                rows={2}
                value={docFocus}
                onChange={(e) => setDocFocus(e.target.value)}
                placeholder={T("Ex.: Capítulo 3; Enunciados 100 a 250; Seção Recursos")}
              />
            )}
            <div className="space-y-1">
              <Label htmlFor="doc-requested-cards">{T("Quantidade desejada de flashcards")}</Label>
              <Input
                id="doc-requested-cards"
                type="number"
                min={Math.max(1, docFiles.length || 1)}
                max={plan.hasSubscription ? 150 : 40}
                value={requestedCards}
                disabled={parsingDoc}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isInteger(value)) setRequestedCards(value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {T(
                  "Cobrança justa: se o documento render menos cards do que você pediu, você só paga pelos flashcards que forem salvos.",
                )}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {T(
                "Os cards são divididos igualmente entre perguntas e respostas, completar e múltipla escolha, sempre com a referência e o texto integral no verso.",
              )}
            </p>
          </div>
          {activeJob && !parsingDoc && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-medium">
                {activeJob.status === "completed"
                  ? T("Seus flashcards estão prontos")
                  : activeJob.status === "failed" || runningJobId !== activeJob.id
                    ? T("O processamento foi interrompido")
                    : T("Processamento em andamento nos bastidores")}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeJob.document_name} — {T("Parte")}{" "}
                {Math.min(activeJob.processed_parts, activeJob.total_parts)}/{activeJob.total_parts}{" "}
                · {activeJob.cards_count} {T("flashcards até agora")}
              </p>
              <Progress
                value={
                  activeJob.total_parts
                    ? (activeJob.processed_parts / activeJob.total_parts) * 100
                    : 0
                }
              />
              <p className="text-xs text-muted-foreground">
                {activeJob.status === "completed"
                  ? T("Nada foi perdido. Carregue os flashcards para revisar e salvar.")
                  : T(
                      "Nada foi perdido: o que já foi gerado está guardado. Não envie o arquivo de novo — continue daqui.",
                    )}
              </p>
              <div className="flex flex-wrap gap-2">
                {activeJob.cards_count > 0 && (
                  <Button
                    size="sm"
                    onClick={() =>
                      loadJobCards(activeJob.id, activeJob.result_cards, activeJob.input_images, activeJob.hint)
                    }
                  >
                    {T("Carregar flashcards gerados")}
                  </Button>
                )}
                {activeJob.status !== "completed" &&
                  (activeJob.input_slices.length > 0 ||
                    (activeJob.input_images.length > 0 &&
                      activeJob.processed_parts < activeJob.total_parts) ||
                    (activeJob.status === "processing" &&
                      activeJob.processed_parts >= activeJob.total_parts)) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runDocumentJob(activeJob, activeJob.input_images)}
                    >
                      {T("Continuar de onde parou")}
                    </Button>
                  )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleDiscardJob(activeJob.id)}
                >
                  {T("Descartar")}
                </Button>
              </div>
            </div>
          )}
          {parsingDoc && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {T("Analisando seu material…")}
              </div>
              <Progress
                value={
                  docProgress && docProgress.total > 0
                    ? (docProgress.done / docProgress.total) * 100
                    : 5
                }
              />
              <p className="text-xs text-muted-foreground">
                {docProgress && docProgress.total > 1
                  ? `${T("Parte")} ${Math.min(docProgress.done + 1, docProgress.total)}/${docProgress.total} · ${docProgress.cards} ${T("flashcards até agora")}`
                  : T("Isso pode levar alguns instantes. Pode deixar esta tela aberta.")}
              </p>
              <p className="text-xs text-muted-foreground">
                {T(
                  "Seu progresso é salvo a cada parte. Se a conexão cair ou o computador travar, o trabalho continua de onde parou quando você voltar — não precisa enviar o arquivo de novo.",
                )}
              </p>
              {plan.isAppManager && <BulkCoinsMeter cards={docProgress?.cards ?? 0} live />}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleParseDoc}
              disabled={parsingDoc || (!docText.trim() && docFiles.length === 0)}
            >
              {parsingDoc ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {b.processing}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" /> {b.generateWithAi}
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4 sm:p-6 space-y-3 border-primary/30">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <h2 className="font-medium">{b.csvTitle}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{b.csvDescription}</p>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                handleCsvFile(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">
              <FileSpreadsheet className="h-4 w-4" /> {b.chooseCsv}
            </span>
          </label>
        </div>
      </Card>

      {!plan.canUseAI ? (
        <ProFeatureCard
          icon={<Camera className="h-5 w-5 text-primary" />}
          title={b.aiPhotoTitle}
          description={T(
            "Envie até 8 fotos de páginas de livro ou apostila por vez. O PilotAI lê o conteúdo e cria flashcards",
          )}
          proDescription={T("Disponível no plano Pro (U$4,99/mês).")}
          copy={b}
        />
      ) : (
        <Card className="p-4 sm:p-6 space-y-3 border-primary/30">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="font-medium">{b.aiPhotoTitle}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {T("Envie até {n} fotos de páginas por vez. O PilotAI lê o conteúdo e cria flashcards.", {
              n: maxAiImages,
            })}
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setImageMode("text")}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                imageMode === "text"
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {b.imageModeText}
            </button>
            <button
              type="button"
              onClick={() => setImageMode("pilot")}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                imageMode === "pilot"
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {b.imageModePilot}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen(true)}>
              <Camera className="h-4 w-4 mr-1" /> {b.takePhoto}
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleAddImages(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              <span className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent">
                <ImagePlus className="h-4 w-4" /> {b.addImages}
              </span>
            </label>
            {images.length > 0 && (
              <span className="text-xs text-muted-foreground self-center">
                {b.imageCount(images.length)}
              </span>
            )}
          </div>

          <div
            tabIndex={0}
            role="textbox"
            aria-multiline="false"
            contentEditable
            suppressContentEditableWarning
            aria-label={T("Área para colar imagem")}
            onPaste={(e) => e.preventDefault()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleAddImages(e.dataTransfer.files);
            }}
            className="flex flex-col items-center justify-center gap-1 min-h-32 rounded-lg border-2 border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground outline-none focus:border-primary focus:bg-primary/5 cursor-text"
          >
            <ClipboardPaste className="h-6 w-6" />
            <span className="font-medium text-foreground">
              {T("Clique aqui e cole a imagem (Ctrl+V)")}
            </span>
            <span className="text-xs">
              {T("Ou arraste uma imagem para cá. Depois você ajusta a área que será usada.")}
            </span>
          </div>

          <CameraCaptureDialog
            open={cameraOpen}
            onOpenChange={setCameraOpen}
            title={b.takePhoto}
            onCapture={(f) => {
              const dt = new DataTransfer();
              dt.items.add(f);
              void handleAddImages(dt.files);
            }}
          />

          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-full h-24 object-cover rounded border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingIdx(i)}
                    className="absolute bottom-1 right-1 h-7 w-7 rounded-md bg-background/90 border border-border flex items-center justify-center shadow"
                    aria-label={b.editCrop}
                  >
                    <Crop className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                    aria-label={b.removeImage}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {imageMode === "text" && (
            <div className="space-y-1">
              <Label htmlFor="image-requested-cards">{T("Quantidade desejada de flashcards")}</Label>
              <Input
                id="image-requested-cards"
                type="number"
                min={1}
                max={plan.hasSubscription ? 150 : 40}
                value={requestedCards}
                disabled={parsingImages}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isInteger(value)) setRequestedCards(value);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {T(
                  "Cobrança justa: se o documento render menos cards do que você pediu, você só paga pelos flashcards que forem salvos.",
                )}
              </p>
            </div>
          )}

          <div className="flex justify-end">
            {imageMode === "pilot" ? (
              <Button
                onClick={handleImagePilot}
                disabled={parsingImages || images.length !== 1}
                title={images.length !== 1 ? b.imagePilotNeedOne : undefined}
              >
                {parsingImages ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {b.imagePilotAnalyzing}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" /> {b.imagePilotAnalyze}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleParseImages} disabled={parsingImages || images.length === 0}>
                {parsingImages ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {b.analyzingPhotos}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" /> {b.generateFromPhotos}
                  </>
                )}
              </Button>
            )}
          </div>

          {pilotDialog && (
            <ImagePilotReviewDialog
              open
              imageDataUrl={pilotDialog.dataUrl}
              initialPins={pilotDialog.pins}
              initialOutputIds={pilotDialog.outputIds}
              suggestedSubject={pilotDialog.subject}
              suggestedTopic={pilotDialog.topic}
              saving={pilotSaving}
              onConfirm={handlePilotConfirm}
              onCancel={handlePilotCancel}
            />
          )}
        </Card>
      )}

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-medium">{b.cardsFilled(validCount)}</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addRow()}>
              <Plus className="h-4 w-4 mr-1" /> {b.add}
            </Button>
            <Button variant="outline" size="sm" onClick={() => addManyRows(5)}>
              +5
            </Button>
            <Button variant="outline" size="sm" onClick={() => addManyRows(10)}>
              +10
            </Button>
          </div>
        </div>

        {validCount > 0 && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 text-warning-foreground px-3 py-2 text-sm dark:text-white">
            {b.unsaved(validCount)}
          </div>
        )}

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] border border-border rounded-lg p-3"
            >
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{b.question(i + 1)}</Label>
                <div className="relative">
                  <Textarea
                    rows={3}
                    value={r.question}
                    onChange={(e) => setRow(i, { question: e.target.value })}
                    placeholder={b.questionPlaceholder}
                    className="pr-12"
                  />
                  <div className="absolute top-2 right-2">
                    <MicButton value={r.question} onChange={(v) => setRow(i, { question: v })} />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{b.answer}</Label>
                <div className="relative">
                  <Textarea
                    rows={3}
                    value={r.answer}
                    onChange={(e) => setRow(i, { answer: e.target.value })}
                    placeholder={b.answerPlaceholder}
                    className="pr-12"
                  />
                  <div className="absolute top-2 right-2">
                    <MicButton value={r.answer} onChange={(v) => setRow(i, { answer: v })} />
                  </div>
                </div>
              </div>
              <div className="flex sm:flex-col items-end justify-end gap-2">
                {r.image && (
                  <div className="relative">
                    <img
                      src={r.image}
                      alt=""
                      className="h-16 w-16 object-cover rounded border border-border"
                    />
                    <button
                      type="button"
                      aria-label={b.removeImage}
                      onClick={() => setRow(i, { image: null })}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeRow(i)}
                  disabled={rows.length <= 1}
                  aria-label={b.remove}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {submit.isPending && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {T("Gravando seus flashcards…")}
            </div>
            <Progress
              value={
                saveProgress && saveProgress.total
                  ? (saveProgress.done / saveProgress.total) * 100
                  : 5
              }
            />
            {saveProgress && (
              <p className="text-xs text-muted-foreground">
                {saveProgress.done}/{saveProgress.total}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          {plan.isAppManager && <BulkCoinsMeter cards={validCount} />}
          <Button
            id="bulk-save-btn"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || validCount === 0}
            size="lg"
          >
            {submit.isPending ? b.creating : b.createCards(validCount)}
          </Button>
        </div>
      </Card>

      <ImageCropDialog
        open={cropQueue.length > 0 || editingIdx !== null}
        imageSrc={
          editingIdx !== null
            ? (images[editingIdx]?.dataUrl ?? null)
            : (cropQueue[0]?.dataUrl ?? null)
        }
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
        copy={b}
      />
    </div>
  );
}

/** Vídeo demonstrativo das funções do PilotAI (preencher quando o vídeo estiver publicado). */
const BULK_DEMO_VIDEO_URL = "";

/** Mostra uma função do PilotAI bloqueada, com selo Pro e convite para assinar. */
function ProFeatureCard({
  icon,
  title,
  description,
  proDescription,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  proDescription?: string;
  copy: ReturnType<typeof useBulkT>;
}) {
  return (
    <Card className="p-4 sm:p-6 space-y-3 border-dashed border-primary/40 bg-muted/30">
      <div className="flex items-center gap-2 flex-wrap">
        {icon}
        <h2 className="font-medium">{title}</h2>
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
          <Sparkles className="h-3 w-3" /> Pro
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="text-sm text-muted-foreground">{proDescription ?? copy.proDescription}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm">
          <Link to="/pricing">{copy.subscribePro}</Link>
        </Button>
        {BULK_DEMO_VIDEO_URL && (
          <a
            href={BULK_DEMO_VIDEO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline"
          >
            {copy.seeDemo}
          </a>
        )}
      </div>
    </Card>
  );
}
