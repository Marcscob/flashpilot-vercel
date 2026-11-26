import { useRef, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { Mic, Square, Loader2, Eraser } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { transcribeAudio } from "@/lib/stt.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  minRows?: number;
};

const errToast = (msg: string) => toast.error(msg, { duration: Infinity, closeButton: true });

// Mesmo teto do MicButton: evita gravações longas (custo de transcrição) e
// mantém consistência com o limite aplicado no servidor.
const MAX_RECORDING_MS = 3 * 60 * 1000;

export function VoiceInput({ value, onChange, placeholder, label, minRows = 3 }: Props) {
  const t = useT();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const showErr = (msg: string) => {
    setLastError(msg);
    errToast(msg);
    // eslint-disable-next-line no-console
    console.error("[VoiceInput]", msg);
  };
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcribe = useServerFn(transcribeAudio);

  function clearAndFocus() {
    onChange("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function start() {
    setLastError(null);
    // Pre-flight checks with clear messaging
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      showErr(T("O microfone só funciona em HTTPS. Abra o app publicado ou use localhost."));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showErr(
        T(
          "Seu navegador não suporta gravação de áudio. Tente Chrome, Safari ou Firefox atualizado.",
        ),
      );
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      showErr(T("MediaRecorder não disponível neste navegador."));
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const e = err as DOMException;
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
        showErr(
          T(
            "Permissão de microfone negada. Habilite nas configurações do navegador e recarregue a página.",
          ),
        );
      } else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") {
        showErr(T("Nenhum microfone encontrado no dispositivo."));
      } else if (e?.name === "NotReadableError") {
        showErr("Microfone em uso por outro aplicativo. Feche outros apps e tente de novo.");
      } else {
        showErr(`Erro ao acessar o microfone: ${e?.message || e?.name || T("desconhecido")}`);
      }
      return;
    }

    try {
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onerror = (ev) => {
        const err = (ev as unknown as { error?: DOMException }).error;
        showErr(
          T("Erro na gravação: {msg}", { msg: err?.message || err?.name || T("desconhecido") }),
        );
      };
      rec.onstop = async () => {
        if (autoStopRef.current) {
          clearTimeout(autoStopRef.current);
          autoStopRef.current = null;
        }
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1500) {
          showErr(`${t.voice.tooShort} (${blob.size} bytes)`);
          return;
        }
        setTranscribing(true);
        try {
          const b64 = await blobToBase64(blob);
          const { text } = await transcribe({ data: { audio_base64: b64, mime_type: blob.type } });
          if (text) onChange(value ? `${value} ${text}` : text);
          else showErr(t.voice.cantUnderstand);
        } catch (err) {
          showErr(err instanceof Error ? err.message : t.voice.transcribeErr);
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      autoStopRef.current = setTimeout(() => {
        if (recorderRef.current === rec && rec.state !== "inactive") {
          toast.info(T("Tempo máximo de gravação atingido."));
          stop();
        }
      }, MAX_RECORDING_MS);
    } catch (err) {
      stream.getTracks().forEach((tr) => tr.stop());
      showErr(err instanceof Error ? err.message : t.voice.micError);
    }
  }

  function stop() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-foreground/80">{label}</label>}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={minRows}
          className="pr-14 pt-10 resize-none bg-card"
        />
        {value && !recording && !transcribing && (
          <button
            type="button"
            onClick={clearAndFocus}
            className="absolute right-2 top-2 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            aria-label={T("Limpar conteúdo")}
            title={T("Limpar conteúdo")}
          >
            <Eraser className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={transcribing}
          className={cn(
            "absolute right-2 bottom-2 h-10 w-10 rounded-full flex items-center justify-center transition-all shadow-soft",
            recording
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : "bg-accent text-accent-foreground hover:brightness-110",
            transcribing && "opacity-60 cursor-not-allowed",
          )}
          aria-label={recording ? t.voice.stopAria : t.voice.startAria}
        >
          {transcribing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : recording ? (
            <Square className="h-4 w-4" fill="currentColor" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </button>
      </div>
      {recording && <p className="text-xs text-destructive font-medium">{t.voice.recording}</p>}
      {transcribing && <p className="text-xs text-muted-foreground">{t.voice.transcribing}</p>}
      {lastError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive space-y-1">
          <p className="font-medium">{T("Erro do microfone (toque para copiar):")}</p>
          <p
            className="select-all break-words cursor-pointer"
            onClick={() => {
              navigator.clipboard?.writeText(lastError).then(
                () => toast.success(T("Erro copiado")),
                () => {},
              );
            }}
          >
            {lastError}
          </p>
          <button type="button" onClick={() => setLastError(null)} className="underline opacity-70">
            {T("Fechar")}
          </button>
        </div>
      )}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// re-export utility
export { Button };
