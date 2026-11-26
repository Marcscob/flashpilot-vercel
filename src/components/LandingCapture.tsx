import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  FileText,
  Loader2,
  MailCheck,
  MessageCircle,
  Sparkles,
  Upload,
  X,
  Square,
  Image as ImageIcon,
} from "lucide-react";

import { CameraCaptureDialog } from "@/components/CameraCaptureDialog";
import { useLang, useOverlayD } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { parseFlashcardsFromFile } from "@/lib/parse-cards-file.functions";
import { createDocumentJob, saveDocumentJobProgress } from "@/lib/bulk-jobs";
import { saveFlashcardsAtomically } from "@/lib/flashcards-save.functions";
import { ensureBulkDemoDestination } from "@/lib/bulk-demo.functions";
import { analyzeImagePilot } from "@/lib/imagepilot.functions";
import { uploadMindMapImage } from "@/lib/mindmap-image";
import { createLandingDraft } from "@/lib/landing-draft.functions";

import { claimWelcomeKit } from "@/lib/welcome-kit.functions";
import { sendWelcomeEmailIfNeeded } from "@/lib/welcome-email.functions";
import {
  clearBulkDemoDraft,
  loadBulkDemoDraft,
  saveBulkDemoDraft,
  type BulkDemoDraft,
  type BulkDemoFile,
} from "@/lib/bulk-demo-storage";
import { friendlyAiError } from "@/lib/ai-error-toast";
import { updateMyProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { YouTubeSourceInput } from "@/components/YouTubeSourceInput";
import { getYoutubeTranscript } from "@/lib/youtube.functions";
import { canonicalYoutubeUrl } from "@/lib/youtube-url";
import { youtubeErrorMessage } from "@/lib/youtube-errors";
import { WebPageSourceInput } from "@/components/WebPageSourceInput";
import { getWebPageText } from "@/lib/web-page.functions";
import { isValidWebPageUrl } from "@/lib/web-page-text";
import { isWebPageError, webPageErrorMessage } from "@/lib/web-page-errors";
import { T } from "@/lib/i18n-ui";

import { landingLegacyCopy } from "@/lib/landing-copy";
import { landingPilotCopy } from "@/lib/landing-pilot-copy";
import { BulkV2CaptureSelector } from "@/components/BulkV2CaptureSelector";
import { useBulkV2T } from "@/lib/i18n-bulk-v2";
import { readDocumentText } from "@/lib/document-import";
import { readSheet, sheetToCards, downloadSheetTemplate } from "@/lib/sheet-import";
import { transcribeAudio } from "@/lib/stt.functions";
import { landingCopy } from "@/lib/landing-content";
import { LandingDeck } from "@/components/LandingDeck";
import { LANDING_LIMITS } from "@/lib/landing-rules";
import { canUseInstantLandingTest, type InstantTestInput } from "@/lib/landing-capture-routing";
import { extractLandingVisitorSourceFn } from "@/lib/landing-visitor-source.functions";
import { HomeStudyMaterials } from "@/components/HomeStudyMaterials";
import { readLandingMaterialPreference } from "@/lib/landing-materials";
import { authEmailRedirectUrl, welcomeLocale } from "@/lib/welcome-locale";
type SelectedFile = BulkDemoFile & { id: string };
type LandingPhase = "idle" | "sending" | "waiting" | "processing" | "saving" | "done" | "error";

const MAX_IMAGES = 1;
const MAX_TEXT_CHARS = 3_000;
const REQUESTED_CARDS = LANDING_LIMITS.cards;
const DEVICE_ID_KEY = "flashpilot:device-id";

function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (
    existing &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)
  ) {
    return existing;
  }

  const deviceId = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function getPastedImages(clipboardData: DataTransfer | null): File[] {
  return Array.from(clipboardData?.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item, index) => {
      const file = item.getAsFile();
      if (!file) return null;
      return file.name
        ? file
        : new File([file], `colada-${Date.now()}-${index}.png`, { type: file.type });
    })
    .filter((file): file is File => Boolean(file));
}

async function stableUuid(seed: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)),
  );
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface LandingCaptureProps {
  onStartInstantTest?: (input: InstantTestInput) => Promise<void> | void;
  isGenerating?: boolean;
}

export function LandingCapture({ onStartInstantTest, isGenerating }: LandingCaptureProps = {}) {
  const { lang, extLang } = useLang();
  const emailLang = welcomeLocale(
    extLang ?? lang,
    typeof navigator === "undefined" ? [] : navigator.languages,
  );
  const overlay = useOverlayD();
  const copyLang = extLang ?? lang;
  const c = landingLegacyCopy(copyLang, overlay ?? undefined);
  const t = useBulkV2T();
  const lc = landingCopy(copyLang, overlay ?? undefined);
  const pc = landingPilotCopy(copyLang, overlay ?? undefined);
  const [capture, setCapture] = useState("text");
  const [audioMode, setAudioMode] = useState<"file" | "mic" | null>(null);
  const [sheetCards, setSheetCards] = useState<{ question: string; answer: string }[]>([]);
  const [showAccess, setShowAccess] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcribeFn = useServerFn(transcribeAudio);
  const router = useRouter();
  const queryClient = useQueryClient();
  async function finishCapture() {
    await clearBulkDemoDraft();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["account-overview"] }),
      queryClient.invalidateQueries({ queryKey: ["ai-billing"] }),
    ]);
    setPhase("done");
    await router.navigate({ to: "/home", replace: true });
  }
  const fileInput = useRef<HTMLInputElement>(null);
  const parseFileFn = useServerFn(parseFlashcardsFromFile);
  const analyzeImagePilotFn = useServerFn(analyzeImagePilot);
  const saveFlashcardsFn = useServerFn(saveFlashcardsAtomically);
  const claimWelcomeKitFn = useServerFn(claimWelcomeKit);
  const sendWelcomeEmailFn = useServerFn(sendWelcomeEmailIfNeeded);
  const [mode, setMode] = useState<"files" | "text" | "youtube" | "web">("text");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const webPageFn = useServerFn(getWebPageText);
  const transcriptFn = useServerFn(getYoutubeTranscript);
  const extractSourceFn = useServerFn(extractLandingVisitorSourceFn);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [text, setText] = useState("");
  const [guidance, setGuidance] = useState("");
  const [imagePilot, setImagePilot] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [cameraOpen, setCameraOpen] = useState(false);
  const [phase, setPhase] = useState<LandingPhase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const truncatedNotice = T(
    "O número de caracteres é maior que o permitido no ambiente de teste. Vamos criar os flashcards até o limite do teste gratuito.",
  );
  // Fluxo novo (texto): rascunho no backend + e-mail de ativação.
  const [draftFlow, setDraftFlow] = useState<"none" | "sent" | "existing">("none");
  const [draftActionId, setDraftActionId] = useState<string | null>(null);
  const [otherTabActive, setOtherTabActive] = useState(false);
  const draftFlowRef = useRef(draftFlow);
  draftFlowRef.current = draftFlow;
  const createDraftFn = useServerFn(createLandingDraft);
  const processedActionRef = useRef<string | null>(null);
  const cancelledActionsRef = useRef<Set<string>>(new Set());
  const cancelGuard = (actionId: string) => {
    if (cancelledActionsRef.current.has(actionId)) throw new Error("__cancelled__");
  };
  async function removeFile(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id));
    const active = processedActionRef.current;
    if (active) cancelledActionsRef.current.add(active);
    const saved = await loadBulkDemoDraft().catch(() => null);
    if (saved) cancelledActionsRef.current.add(saved.actionId);
    await clearBulkDemoDraft().catch(() => {});
    processedActionRef.current = null;
    setPhase("idle");
    setError("");
  }
  const processDraftRef = useRef<(draft: BulkDemoDraft) => Promise<void>>(async () => {});
  const addFilesRef = useRef<(incoming: FileList | File[]) => Promise<void>>(async () => {});

  const busy =
    phase === "sending" || phase === "waiting" || phase === "processing" || phase === "saving";
  const textOver = mode === "text" && text.length > LANDING_LIMITS.textFieldChars;

  function draftFromState(actionId: string): BulkDemoDraft {
    return {
      version: 1,
      actionId,
      fullName: fullName.trim(),
      email: email.trim(),
      guidance: guidance.trim(),
      imagePilot: mode === "files" && imagePilot,
      mode,
      youtubeUrl: mode === "youtube" ? youtubeUrl.trim() : undefined,
      webUrl: mode === "web" ? webUrl.trim() : undefined,
      text: mode === "text" ? text.trim().slice(0, LANDING_LIMITS.textFieldChars) : "",
      files: files.map(({ id: _id, ...file }) => file),
      createdAt: Date.now(),
    };
  }

  function restoreDraft(draft: BulkDemoDraft) {
    setMode(draft.mode);
    setCapture(
      draft.mode === "text"
        ? "text"
        : draft.mode === "youtube"
          ? "youtube"
          : draft.mode === "web"
            ? "web"
            : draft.files[0]?.type.startsWith("audio/")
              ? "audio"
              : /\.(csv|xlsx|xls)$/i.test(draft.files[0]?.name ?? "")
                ? "csv"
                : draft.files[0]?.type.startsWith("image/")
                  ? "image"
                  : "doc",
    );
    setYoutubeUrl(draft.youtubeUrl ?? "");
    setWebUrl(draft.webUrl ?? "");
    setGuidance(draft.guidance ?? "");
    setImagePilot(!!draft.imagePilot);
    setFullName(draft.fullName ?? "");
    setEmail(draft.email);
    setText(draft.text);
    setFiles(
      draft.files.map((file, index) => ({
        ...file,
        id: `${file.name}-${file.size}-${index}`,
      })),
    );
  }

  async function fileToDataUrl(file: File): Promise<string> {
    if (file.type === "application/pdf") {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }

    const bitmap =
      typeof createImageBitmap === "function"
        ? await createImageBitmap(file).catch(() => null)
        : null;
    if (!bitmap) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx2d = canvas.getContext("2d");
    if (ctx2d) {
      // JPEG não tem transparência: sem fundo branco, PNGs transparentes ficam pretos.
      ctx2d.fillStyle = "#fff";
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);
      ctx2d.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  async function addFiles(incoming: FileList | File[]) {
    const selected = Array.from(incoming);
    if (selected.length > 1) {
      setError(c.tooManyFiles);
      return;
    }
    const validFiles = selected.filter(
      (file) =>
        file.type === "image/png" ||
        file.type === "image/jpeg" ||
        file.type === "image/webp" ||
        file.type === "application/pdf" ||
        /\.(docx|txt|csv|xlsx|xls)$/i.test(file.name) ||
        file.type.startsWith("audio/"),
    );
    if (!validFiles.length) {
      setError(c.fileReadFailed);
      return;
    }
    if (
      validFiles.some(
        (file) =>
          file.size >
          (file.type.startsWith("audio/") ? LANDING_LIMITS.audioBytes : LANDING_LIMITS.fileBytes),
      )
    ) {
      setError(c.fileTooLarge);
      return;
    }
    const hasPdf = files.some((file) => file.type === "application/pdf");
    const nextPdf = validFiles.some((file) => file.type === "application/pdf");
    if (
      (hasPdf || nextPdf) &&
      (hasPdf || validFiles.filter((file) => file.type === "application/pdf").length > 1)
    ) {
      setError(c.tooManyFiles);
      return;
    }
    const currentImages = files.filter((file) => file.type.startsWith("image/")).length;
    const incomingImages = validFiles.filter((file) => file.type.startsWith("image/"));
    if (currentImages + incomingImages.length > MAX_IMAGES) {
      setError(c.tooManyFiles);
      return;
    }
    try {
      const firstFile = validFiles[0];
      if (!firstFile) return;
      setNotice("");
      const converted = await Promise.all(
        validFiles.map(async (file) => ({
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: await fileToDataUrl(file),
          extractedText: /\.(pdf|docx|txt)$/i.test(file.name)
            ? await readDocumentText(file, LANDING_LIMITS.textChars, {
                truncate: true,
                onTruncate: () => setNotice(truncatedNotice),
              })
            : undefined,
        })),
      );
      if (capture === "csv") {
        const sheet = await readSheet(firstFile);
        const cards = sheetToCards(sheet, { q: lc.question, a: lc.answer });
        if (sheet.cols !== 2 || !cards.length || cards.length > LANDING_LIMITS.sheetRows)
          throw new Error(lc.sheetError);
        setSheetCards(cards);
      }
      setFiles(converted);
      setError("");
    } catch (readError) {
      console.error("Failed to read landing file", readError);
      setError(readError instanceof Error ? readError.message : c.fileReadFailed);
    }
  }

  addFilesRef.current = addFiles;

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const pastedImages = getPastedImages(event.clipboardData);
      if (!pastedImages.length) return;
      event.preventDefault();
      setMode("files");
      setCapture("image");
      setError("");
      setPhase("idle");
      void addFilesRef.current(pastedImages);
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    void addFiles(event.dataTransfer.files);
  }

  async function buildInstantInput(): Promise<InstantTestInput | null> {
    const emptyFail = (message: string) => {
      setError(message);
      return null;
    };
    if (mode === "text") {
      return text.trim().slice(0, LANDING_LIMITS.textFieldChars) || emptyFail(c.emptyInput);
    }
    if (mode === "youtube") {
      const url = youtubeUrl.trim();
      return async () => {
        try {
          return (await extractSourceFn({ data: { kind: "youtube", url, lang } })).text;
        } catch (youtubeError) {
          if (youtubeError instanceof Error && youtubeError.message.includes("YOUTUBE_")) {
            throw new Error(youtubeErrorMessage(youtubeError));
          }
          throw youtubeError;
        }
      };
    }
    if (mode === "web") {
      const url = webUrl.trim();
      return async () => {
        try {
          return (await extractSourceFn({ data: { kind: "web", url } })).text;
        } catch (webError) {
          if (isWebPageError(webError)) throw new Error(webPageErrorMessage(webError));
          throw webError;
        }
      };
    }
    const file = files[0];
    if (!file) return emptyFail(c.emptyInput);
    if (/\.(csv|xlsx|xls)$/i.test(file.name)) {
      try {
        const blob = await (await fetch(file.dataUrl)).blob();
        const sheet = await readSheet(new File([blob], file.name, { type: file.type }));
        const cards = sheetToCards(sheet, { q: lc.question, a: lc.answer });
        if (sheet.cols !== 2 || !cards.length || cards.length > LANDING_LIMITS.sheetRows) {
          return emptyFail(lc.sheetError);
        }
        return {
          cards: cards.slice(0, LANDING_LIMITS.cards),
          source: cards
            .slice(0, LANDING_LIMITS.cards)
            .map((card) => `${card.question}\n${card.answer}`)
            .join("\n\n")
            .slice(0, 15_000),
        };
      } catch {
        return emptyFail(lc.sheetError);
      }
    }
    if (file.type.startsWith("image/")) {
      return async () =>
        (await extractSourceFn({ data: { kind: "image", dataUrl: file.dataUrl, lang } })).text;
    }
    if (file.type.startsWith("audio/")) {
      return async () =>
        (
          await extractSourceFn({
            data: { kind: "audio", dataUrl: file.dataUrl, mimeType: file.type, lang },
          })
        ).text;
    }
    return file.extractedText?.trim() || emptyFail(c.fileReadFailed);
  }

  async function processDraft(draft: BulkDemoDraft) {
    if (processedActionRef.current === draft.actionId) return;
    if (cancelledActionsRef.current.has(draft.actionId)) return;
    processedActionRef.current = draft.actionId;
    setPhase("processing");
    setError("");
    let jobId: string | null = null;
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Sessão não confirmada.");
      if (draft.fullName?.trim()) {
        await updateMyProfile({ data: { fullName: draft.fullName.trim() } });
      }

      try {
        await claimWelcomeKitFn({ data: { deviceId: getDeviceId() } });
      } catch (welcomeError) {
        console.error("Failed to claim landing welcome kit", welcomeError);
      }
      try {
        await sendWelcomeEmailFn({ data: { lang: emailLang } });
      } catch (welcomeEmailError) {
        console.error("Failed to send landing welcome email", welcomeEmailError);
      }

      const sourceFiles = draft.mode === "files" ? draft.files : [];
      const pdf = sourceFiles.find((file) => file.type === "application/pdf");
      const images = sourceFiles
        .filter((file) => file.type.startsWith("image/"))
        .map((file) => file.dataUrl);
      const transcript =
        draft.mode === "youtube"
          ? await transcriptFn({ data: { url: draft.youtubeUrl ?? "", lang } })
          : null;
      const webPage =
        draft.mode === "web" ? await webPageFn({ data: { url: draft.webUrl ?? "" } }) : null;
      const audioFile = sourceFiles.find((file) => file.type.startsWith("audio/"));
      const spoken = audioFile
        ? await transcribeFn({
            data: { audio_base64: audioFile.dataUrl, mime_type: audioFile.type, lang },
          })
        : null;
      const extractedText = spoken
        ? spoken.text
        : transcript
          ? transcript.text
          : webPage
            ? webPage.text.slice(0, MAX_TEXT_CHARS)
            : draft.mode === "text"
            ? draft.text.trim()
            : sourceFiles
                .map((file) => file.extractedText?.trim() ?? "")
                .filter(Boolean)
                .join("\n\n")
                .slice(0, MAX_TEXT_CHARS);
      const sheetFile = sourceFiles.find((file) => /\.(csv|xlsx|xls)$/i.test(file.name));
      if (sheetFile) {
        const blob = await (await fetch(sheetFile.dataUrl)).blob();
        const data = await readSheet(new File([blob], sheetFile.name, { type: sheetFile.type }));
        const imported = sheetToCards(data, { q: lc.question, a: lc.answer });
        if (data.cols !== 2 || !imported.length || imported.length > LANDING_LIMITS.sheetRows)
          throw new Error(lc.sheetError);
        const dest = await ensureBulkDemoDestination();
        await saveFlashcardsFn({
          data: {
            actionId: draft.actionId,
            cards: imported.map((card) => ({ ...card, topicId: dest.topicId })),
          },
        });
        await finishCapture();
        return;
      }
      let genActionId = draft.actionId;
      let fallbackImage: string | null = null;
      let pilotAnalysis: Awaited<ReturnType<typeof analyzeImagePilotFn>> | null = null;
      if (draft.imagePilot) {
        if (images.length !== 1 || sourceFiles.length !== 1) throw new Error(pc.needOne);
        const pilotJob = await createDocumentJob({
          actionId: draft.actionId,
          documentName: sourceFiles[0]?.name ?? "ImagePilot",
          mode: "total",
          totalParts: 1,
          requestedCards: REQUESTED_CARDS,
          slices: [],
          images,
          hint: draft.guidance?.trim() || "",
        });
        jobId = pilotJob.id;
        const analysis = await analyzeImagePilotFn({
          data: {
            actionId: draft.actionId,
            jobId: pilotJob.id,
            requestedCards: REQUESTED_CARDS,
            image: images[0],
            hint: draft.guidance?.trim() || undefined,
            lang,
          },
        });
        pilotAnalysis = analysis;
        if (!analysis.pins.length) {
          // Sem estruturas: a imagem vai para o card e o PilotAI cria perguntas
          // sobre o texto/conteúdo da imagem (fluxo comum abaixo).
          fallbackImage = images[0];
          genActionId = await stableUuid(`${draft.actionId}:fallback`);
        }
      }
      if (draft.imagePilot && !fallbackImage) {
        const analysis = pilotAnalysis;
        if (!analysis || !jobId) throw new Error(c.fileReadFailed);
        const pilotJob = { id: jobId };
        cancelGuard(draft.actionId);
        setPhase("saving");
        const dest = await ensureBulkDemoDestination({
          subjectName: analysis.subject?.trim() || undefined,
          language: lang,
          topicName: analysis.topic?.trim() || undefined,
          cards: analysis.pins.slice(0, 12).map((p) => ({
            question: pc.question.replace("{n}", String(p.n)),
            answer: p.label,
          })),
        });
        const blob = await (await fetch(images[0])).blob();
        const imagePath = await uploadMindMapImage(
          new File([blob], `imagepilot-${Date.now()}.png`, { type: blob.type || "image/png" }),
          null,
        );
        await saveFlashcardsFn({
          data: {
            actionId: await stableUuid(`${draft.actionId}:save`),
            cards: analysis.pins.slice(0, REQUESTED_CARDS).map((p, i) => ({
              topicId: dest.topicId,
              question: pc.question.replace("{n}", String(p.n)),
              answer: p.label,
              cardFormat: "imagepilot",
              imageUrl: imagePath,
              imagePins: analysis.pins,
              imageFocus: p.n,
              generatedJobId: pilotJob.id,
              generatedOutputId: analysis.outputIds[i] ?? null,
            })),
          },
        });
        await saveDocumentJobProgress(pilotJob.id, {
          processed_parts: 1,
          cards: [],
          status: "completed",
        });
        await finishCapture();
        return;
      }
      const job = await createDocumentJob({
        actionId: genActionId,
        documentName: transcript?.title ?? pdf?.name ?? sourceFiles[0]?.name ?? "Material enviado",
        mode: "sample",
        totalParts: 1,
        requestedCards: REQUESTED_CARDS,
        slices: extractedText ? [extractedText] : [],
        images,
        hint: "Material enviado pela landing page",
        focus: draft.guidance?.trim() || undefined,
      });
      jobId = job.id;
      const result = await parseFileFn({
        data: {
          actionId: genActionId,
          jobId: job.id,
          requestedCards: REQUESTED_CARDS,
          text: extractedText,
          pdf:
            !extractedText && pdf
              ? {
                  filename: pdf.name,
                  dataUrl: pdf.dataUrl.replace(/^data:[^;]*;/, "data:application/pdf;"),
                }
              : undefined,
          images,
          hint: "Material enviado pela landing page",
          mode: "sample",
          focus: draft.guidance?.trim() || undefined,
          identifyDestination: true,
          outputLang: lang,
        },
      });
      if (!result.cards.length) throw new Error(c.fileReadFailed);
      const destination = result.destination ?? draft.destination ?? null;
      if (result.destination && result.destination !== draft.destination) {
        await saveBulkDemoDraft({ ...draft, destination: result.destination });
      }
      await saveDocumentJobProgress(job.id, {
        processed_parts: 1,
        cards: result.cards.slice(0, REQUESTED_CARDS).map((card) => ({
          question: card.question,
          answer: card.answer,
          image_index: card.image_index,
          generatedOutputId: card.generatedOutputId,
        })),
        status: "completed",
      });

      cancelGuard(draft.actionId);
      setPhase("saving");
      const destinationIds = await ensureBulkDemoDestination({
        subjectName: destination?.subject?.trim() || undefined,
        language: lang,
        topicName: destination?.topic?.trim() || undefined,
        cards: result.cards.slice(0, 12).map((card) => ({
          question: card.question,
          answer: card.answer,
        })),
      });
      let fallbackPath: string | null = null;
      if (fallbackImage) {
        const blob = await (await fetch(fallbackImage)).blob();
        fallbackPath = await uploadMindMapImage(
          new File([blob], `imagepilot-${Date.now()}.png`, { type: blob.type || "image/png" }),
          null,
        );
      }
      await saveFlashcardsFn({
        data: {
          actionId: await stableUuid(`${genActionId}:save`),
          cards: result.cards.slice(0, REQUESTED_CARDS).map((card) => ({
            topicId: destinationIds.topicId,
            question: card.question,
            answer: card.answer,
            cardFormat: fallbackPath ? "imagepilot" : "plain",
            ...(fallbackPath ? { imageUrl: fallbackPath, imagePins: null } : {}),
            generatedJobId: job.id,
            generatedOutputId: card.generatedOutputId ?? null,
            videoUrl1: transcript?.url ?? null,
          })),
        },
      });
      await finishCapture();
    } catch (processError) {
      if (processError instanceof Error && processError.message === "__cancelled__") {
        if (jobId)
          void saveDocumentJobProgress(jobId, {
            status: "failed",
            error_message: "cancelled",
          }).catch(() => {});
        return;
      }
      console.error("Landing generation failed", processError);
      if (jobId) {
        try {
          await saveDocumentJobProgress(jobId, {
            status: "failed",
            error_message:
              processError instanceof Error
                ? processError.message.slice(0, 2000)
                : "Falha no processamento.",
          });
        } catch (jobError) {
          console.error("Failed to mark landing job as failed", jobError);
        }
      }
      processedActionRef.current = null;
      setError(
        processError instanceof Error && processError.message.includes("YOUTUBE_")
          ? youtubeErrorMessage(processError)
          : isWebPageError(processError)
            ? webPageErrorMessage(processError)
            : friendlyAiError(processError).text,
      );
      setPhase("error");
    }
  }

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode === "youtube" && !canonicalYoutubeUrl(youtubeUrl)) {
      setError(T("Link do YouTube inválido"));
      return;
    }
    if (mode === "web" && !isValidWebPageUrl(webUrl)) {
      setError(T("Link de página da web inválido"));
      return;
    }
    if (
      mode === "files"
        ? files.length === 0
        : mode === "text"
          ? !text.trim()
          : mode === "web"
            ? !webUrl.trim()
            : !youtubeUrl.trim()
    ) {
      setError(c.emptyInput);
      return;
    }
    if (
      mode === "files" &&
      imagePilot &&
      (files.length !== 1 || !files[0].type.startsWith("image/"))
    ) {
      setError(pc.needOne);
      return;
    }
    if (fullName.trim().length < 2) {
      setError(c.invalidName);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(c.invalidEmail);
      return;
    }
    const actionId = crypto.randomUUID();
    const draft = draftFromState(actionId);
    try {
      await saveBulkDemoDraft(draft);
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await processDraft(draft);
        return;
      }
      setPhase("sending");

      // Texto digitado/colado: rascunho no backend + e-mail de ativação com
      // token (TTL 24h). A geração acontece no primeiro acesso, em background.
      if (mode === "text") {
        const result = await createDraftFn({
          data: {
            actionId,
            email: draft.email,
            fullName: draft.fullName,
            content: draft.text,
            lang: emailLang,
            wantNote: readLandingMaterialPreference().note,
            wantMap: readLandingMaterialPreference().map,
          },
        });
        setDraftActionId(actionId);
        setDraftFlow(result.existing ? "existing" : "sent");
        setPhase("waiting");
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: draft.email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: authEmailRedirectUrl(window.location.origin, emailLang, true),
          data: { full_name: draft.fullName, ui_lang: emailLang },
        },
      });
      if (otpError) {
        console.error("Landing access request failed", otpError);
        setError(c.emailSendFailed);
        setPhase("error");
        return;
      }
      setPhase("waiting");
    } catch (requestError) {
      console.error("Landing access request failed", requestError);
      setError(requestError instanceof Error ? requestError.message : c.fileReadFailed);
      setPhase("error");
    }
  }

  processDraftRef.current = processDraft;

  useEffect(() => {
    let active = true;
    const resume = async (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"],
    ) => {
      if (!active || !session?.user) return;
      // Fluxo do rascunho: a ativação acontece na outra aba; aqui só avisamos,
      // sem recarregar nem navegar.
      if (draftFlowRef.current !== "none") {
        setOtherTabActive(true);
        return;
      }
      if (new URLSearchParams(window.location.search).get("resume") !== "1") {
        await router.navigate({ to: "/home", replace: true });
        return;
      }
      const draft = await loadBulkDemoDraft();
      if (!active) return;
      if (!draft) {
        await router.navigate({ to: "/home", replace: true });
        return;
      }
      restoreDraft(draft);
      await processDraftRef.current(draft);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void resume(session);
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        console.error("Failed to restore landing session", sessionError);
        return;
      }
      void resume(data.session);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  function selectSource(source: string, audio?: "file" | "mic") {
    setCapture(source);
    setAudioMode(audio ?? null);
    setMode(
      source === "text" ? "text" : source === "youtube" ? "youtube" : source === "web" ? "web" : "files",
    );
    setFiles([]);
    setSheetCards([]);
    setImagePilot(false);
    setError("");
    setShowAccess(false);
    if (source === "photo") setCameraOpen(true);
    if (source === "audio" && audio === "file" && fileInput.current) {
      fileInput.current.accept = "audio/*";
      fileInput.current.click();
    }
    if ((source === "doc" || source === "csv") && fileInput.current) {
      fileInput.current.accept = source === "csv" ? ".csv,.xlsx,.xls" : ".pdf,.docx,.txt";
      fileInput.current.click();
    }
    if (source === "audio" && audio === "mic") void record();
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timer.current) clearTimeout(timer.current);
        setRecording(false);
        recorder.current = null;
        void addFiles([
          new File([new Blob(chunks, { type: rec.mimeType })], "narration.webm", {
            type: rec.mimeType,
          }),
        ]);
      };
      rec.start();
      setRecording(true);
      timer.current = setTimeout(
        () => rec.state !== "inactive" && rec.stop(),
        LANDING_LIMITS.recordingMs,
      );
    } catch {
      setError(lc.micError);
    }
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stream.getTracks().forEach((track) => track.stop());
        recorder.current.stop();
      }
    },
    [],
  );
  const imageZone = capture === "image" || capture === "photo";
  const pickZone = capture === "doc" || capture === "csv";
  const openPicker = () => fileInput.current?.click();
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4" id="capture">
      {draftFlow !== "none" ? (
        <div className="landing-capture space-y-4 border border-border bg-card p-8 text-center">
          {otherTabActive ? (
            <p role="status" className="text-sm font-medium">
              {T("Ativação em andamento na outra aba. Você já pode fechar esta página.")}
            </p>
          ) : draftFlow === "sent" ? (
            <>
              <MailCheck className="mx-auto h-10 w-10 text-success" />
              <h2 className="text-lg font-semibold">{c.emailSent}</h2>
              <p className="text-sm text-muted-foreground">
                {T("Abra o e-mail, defina sua senha e o PilotAI criará seus flashcards.")}
              </p>
              <p className="rounded-lg bg-muted p-3 text-sm font-medium">
                {T("Não encontrou? Verifique a pasta de Spam ou Lixo Eletrônico.")}
              </p>
            </>
          ) : (
            <>
              <MailCheck className="mx-auto h-10 w-10 text-primary" />
              <h2 className="text-lg font-semibold">{T("Vimos que você já tem conta!")}</h2>
              <p className="text-sm text-muted-foreground">
                {T("Faça login abaixo para gerar os flashcards deste texto.")}
              </p>
              <Button asChild className="mx-auto">
                <Link to="/auth" search={{ actionId: draftActionId ?? undefined }}>
                  {T("Entrar na minha conta")}
                  <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <BulkV2CaptureSelector
            capture={capture}
            audioMode={audioMode}
            onSelect={selectSource}
            t={t}
            disabled={busy || recording}
          />
          <div className="landing-capture space-y-4 border border-border bg-card p-5 sm:p-6">
            <input
              type="file"
              ref={fileInput}
              className="sr-only"
              aria-label={c.chooseFiles}
              accept={
                capture === "doc"
                  ? ".pdf,.docx,.txt"
                  : capture === "csv"
                    ? ".csv,.xlsx,.xls"
                    : capture === "audio"
                      ? "audio/*"
                      : "image/png,image/jpeg,image/webp"
              }
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {capture === "text" ? (
              <div>
                <textarea
                  aria-label={t.typeText}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={c.pasteHint}
                  rows={5}
                  aria-invalid={textOver}
                  className={`w-full resize-y rounded-md border bg-background p-4 text-base leading-relaxed ${
                    textOver ? "border-amber-500 ring-2 ring-amber-500/30" : "border-input"
                  }`}
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                  {textOver ? (
                    <p role="status" className="font-medium text-amber-600">
                      {T(
                        "O número de caracteres é maior que o permitido no ambiente de teste. Vamos criar os flashcards até o limite do teste gratuito.",
                      )}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span
                    className={textOver ? "font-semibold text-amber-600" : "text-muted-foreground"}
                  >
                    {text.length.toLocaleString(lang)} /{" "}
                    {LANDING_LIMITS.textFieldChars.toLocaleString(lang)}
                  </span>
                </div>
                <div className="mt-3">
                  <HomeStudyMaterials variant="landing" sourceText={text} />
                </div>
              </div>
            ) : capture === "youtube" ? (
              <YouTubeSourceInput value={youtubeUrl} onChange={setYoutubeUrl} disabled={busy} />
            ) : capture === "web" ? (
              <WebPageSourceInput value={webUrl} onChange={setWebUrl} disabled={busy} />
            ) : (
              <>
                <div
                  tabIndex={imageZone || pickZone ? 0 : undefined}
                  role={pickZone ? "button" : undefined}
                  aria-label={
                    pickZone ? (capture === "csv" ? t.groupSheets : t.uploadDocument) : undefined
                  }
                  onClick={pickZone ? openPicker : undefined}
                  onKeyDown={
                    pickZone
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openPicker();
                          }
                        }
                      : undefined
                  }
                  className={
                    imageZone || pickZone
                      ? "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                      : "flex flex-wrap items-center justify-center gap-3 py-3"
                  }
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                >
                  {imageZone && <ImageIcon className="h-8 w-8 text-primary" aria-hidden />}
                  {pickZone && <FileText className="h-8 w-8 text-primary" aria-hidden />}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {imageZone && (
                      <>
                        <Button variant="default" onClick={openPicker} disabled={busy}>
                          <Upload />
                          {c.chooseFiles}
                        </Button>
                        <Button variant="outline" onClick={() => setCameraOpen(true)}>
                          <Camera />
                          {t.takePhoto}
                        </Button>
                      </>
                    )}
                    {capture === "audio" && recording && (
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={() => void record()}
                        className="motion-safe:animate-pulse"
                      >
                        <Square />
                        {lc.stop}
                      </Button>
                    )}
                  </div>
                  {imageZone && <p className="text-sm text-muted-foreground">{t.pasteHint}</p>}
                  {pickZone && (
                    <>
                      <p className="text-sm font-medium">
                        {capture === "csv" ? t.groupSheets : c.dropTitle}
                      </p>
                      <p className="text-sm text-muted-foreground">{c.dropHint}</p>
                    </>
                  )}
                  {capture === "csv" && (
                    <Button
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        void downloadSheetTemplate(
                          {
                            q: lc.question,
                            a: lc.answer,
                            ex: lc.decks.map(([, q, a]) => [q, a]),
                          },
                          `flashpilot-${copyLang}.xlsx`,
                          "FlashPilot",
                        );
                      }}
                    >
                      <FileText />
                      {lc.template}
                    </Button>
                  )}
                </div>
                {capture === "audio" && (
                  <p className="text-center text-sm text-muted-foreground">{lc.audioNote}</p>
                )}
                {(capture === "image" || capture === "photo") && (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={imagePilot}
                        onChange={(e) => setImagePilot(e.target.checked)}
                      />
                      ImagePilot
                    </label>
                    <details className="relative inline-block">
                      <summary
                        className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-primary/50 text-xs font-bold text-primary"
                        aria-label={T("Informações sobre o ImagePilot")}
                        title={pc.help}
                      >
                        i
                      </summary>
                      <span className="absolute left-1/2 z-20 mt-2 block w-72 -translate-x-1/2 rounded-md border border-border bg-popover p-3 text-start text-xs leading-5 text-popover-foreground shadow-lg">
                        {pc.help}
                      </span>
                    </details>
                  </div>
                )}
                {capture === "csv" && (
                  <p className="text-center text-sm font-semibold text-success">{lc.freeSheet}</p>
                )}
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between gap-2 border-t border-border pt-3"
                  >
                    <span className="truncate text-sm">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={c.cancel}
                      onClick={() => void removeFile(file.id)}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </>
            )}
            {notice && !error && (
              <p role="status" className="text-sm font-medium text-amber-600">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <Button
                onClick={async () => {
                  setError("");
                  if (mode === "text" && !text.trim()) {
                    setError(c.emptyInput);
                    return;
                  }
                  if (mode === "files" && !files.length) {
                    setError(c.emptyInput);
                    return;
                  }
                  if (mode === "youtube" && !canonicalYoutubeUrl(youtubeUrl)) {
                    setError(youtubeUrl.trim() ? T("Link do YouTube inválido") : c.emptyInput);
                    return;
                  }
                  if (mode === "web" && !isValidWebPageUrl(webUrl)) {
                    setError(webUrl.trim() ? T("Link de página da web inválido") : c.emptyInput);
                    return;
                  }
                  if (onStartInstantTest && canUseInstantLandingTest(mode, files)) {
                    const input = await buildInstantInput();
                    if (input === null) return;
                    await onStartInstantTest(input);
                    return;
                  }
                  setShowAccess(true);
                }}
                disabled={recording || busy || isGenerating}
              >
                <Sparkles />
                {capture === "csv" ? lc.saveDeck : c.submit}
                <ArrowRight />
              </Button>
            </div>
            {showAccess && (
              <form
                onSubmit={requestAccess}
                className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"
              >
                <label className="text-sm">
                  {c.nameLabel}
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                  />
                </label>
                <label className="text-sm">
                  {c.emailLabel}
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                  />
                </label>
                <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">{c.privacy}</p>
                <Button type="submit" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <MailCheck />}
                  {c.bottomCta}
                </Button>
                {phase === "waiting" && (
                  <p role="status" className="text-sm text-success sm:col-span-2">
                    {c.emailSent} {c.emailWait}
                  </p>
                )}
                {(phase === "processing" || phase === "saving") && (
                  <p role="status" className="text-sm sm:col-span-2">
                    {c.processing}
                  </p>
                )}
              </form>
            )}
          </div>
        </>
      )}
      {sheetCards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {sheetCards.slice(0, 3).map((card, i) => (
            <LandingDeck
              key={i}
              title={`CSV / Excel · ${i + 1}`}
              question={card.question}
              answer={card.answer}
            />
          ))}
        </div>
      )}
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        title={c.cameraTitle}
        labels={{
          switchCamera: c.switchCamera,
          cancel: c.cancel,
          capture: c.capture,
          unavailable: c.cameraUnavailable,
        }}
        onCapture={(file) => void addFiles([file])}
      />
    </div>
  );
}
