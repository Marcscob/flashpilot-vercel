import { useEffect, useRef, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { Mic, Square, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { transcribeAudio } from "@/lib/stt.functions";
import { toast } from "sonner";
import { toastAiError } from "@/lib/ai-error-toast";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  variant?: "light" | "dark";
  /** Idioma alvo do ditado; sem ele, o comportamento é o atual (português). */
  lang?: string;
  /**
   * Quando presente, o texto ditado é entregue por aqui (em vez de só
   * preencher o campo) — usado pela Conversação para enviar ao parar.
   */
  onDictated?: (text: string) => void;
  /** Desativa o botão (ex.: enquanto o app gera ou salva). */
  disabled?: boolean;
  /**
   * Modo "botão de opção": quando idleLabel é informado, o componente deixa de
   * ser o círculo pequeno dentro do campo e vira um botão largo que grava ao
   * toque, mostra "Gravando…" e oscila de cor enquanto captura áudio.
   */
  idleLabel?: React.ReactNode;
  recordingLabel?: React.ReactNode;
  busyLabel?: React.ReactNode;
  /** Quando false, qualquer gravação em andamento é descartada. */
  active?: boolean;
  /** Avisado no instante em que a gravação começa (serve para trocar de opção). */
  onStart?: () => void;
};

// Encerra a gravação sozinha depois de 3 minutos: evita que o usuário grave
// áudio muito longo (custo de transcrição) e mantém o uso previsto (ditado
// curto), alinhado ao teto de tamanho aplicado no servidor.
const MAX_RECORDING_MS = 3 * 60 * 1000;

export function MicButton({
  value,
  onChange,
  className,
  variant = "light",
  lang,
  onDictated,
  disabled,
  idleLabel,
  recordingLabel,
  busyLabel,
  active = true,
  onStart,
}: Props) {
  const t = useT();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // O texto ditado é somado ao que já estava no campo; como a transcrição
  // chega depois de a gravação terminar, o valor precisa ser lido do ref —
  // senão o que o usuário digitou durante a gravação se perderia.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  const transcribe = useServerFn(transcribeAudio);

  // Encerra sem transcrever: usado ao trocar de opção ou sair da tela, para o
  // microfone não continuar aberto nem gerar uma transcrição indesejada.
  function discard() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const rec = recorderRef.current;
    if (!rec) return;
    rec.onstop = null;
    try {
      rec.stop();
    } catch {
      // já encerrado
    }
    rec.stream.getTracks().forEach((tr) => tr.stop());
    recorderRef.current = null;
    setRecording(false);
  }

  useEffect(() => {
    if (!active) discard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(
    () => () => {
      discard();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function start() {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) return toast.error(T("Microfone requer HTTPS."));
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return toast.error(T("Navegador sem suporte a gravação."));
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (
        name === "NotFoundError" ||
        name === "OverconstrainedError" ||
        name === "NotReadableError"
      ) {
        return toast.error(
          T(
            'Nenhum microfone encontrado neste dispositivo. Conecte um fone com microfone ou use "Enviar arquivo".',
          ),
        );
      }
      if (name === "NotAllowedError" || name === "SecurityError") {
        return toast.error(
          T(
            "O microfone está bloqueado. Clique no cadeado ao lado do endereço do site e permita o microfone.",
          ),
        );
      }
      return toast.error(T("Permissão de microfone negada."));
    }
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
    rec.onstop = async () => {
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current);
        autoStopRef.current = null;
      }
      stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1500) return toast.error(t.voice.tooShort);
      setTranscribing(true);
      try {
        const b64 = await blobToBase64(blob);
        const { text } = await transcribe({
          data: { audio_base64: b64, mime_type: blob.type, ...(lang ? { lang } : {}) },
        });
        if (text) {
          const base = valueRef.current;
          const combined = base ? `${base} ${text}` : text;
          if (onDictated) onDictated(combined);
          else onChange(combined);
        } else toast.error(t.voice.cantUnderstand);
      } catch (err) {
        if (err instanceof Error) toastAiError(err);
        else toast.error(t.voice.transcribeErr);
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

  if (idleLabel !== undefined) {
    const label = transcribing
      ? (busyLabel ?? idleLabel)
      : recording
        ? (recordingLabel ?? idleLabel)
        : idleLabel;
    return (
      <Button
        type="button"
        variant={recording ? "default" : "outline"}
        disabled={disabled || transcribing}
        aria-pressed={recording}
        onClick={
          recording
            ? stop
            : () => {
                onStart?.();
                void start();
              }
        }
        className={cn(
          "h-auto min-h-10 max-w-full whitespace-normal text-start motion-safe:hover:scale-[1.025]",
          recording
            ? "record-oscillate border-transparent"
            : "hover:bg-primary/5 hover:text-foreground",
          transcribing && "opacity-70",
          className,
        )}
      >
        {transcribing ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : recording ? (
          <Square className="h-4 w-4 shrink-0" fill="currentColor" />
        ) : (
          <Mic className="h-4 w-4 shrink-0" />
        )}
        {label}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={disabled || transcribing}
      className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center transition-all shadow-soft shrink-0",
        recording
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : variant === "dark"
            ? "bg-primary-foreground text-primary hover:brightness-110"
            : "bg-accent text-accent-foreground hover:brightness-110",
        transcribing && "opacity-60 cursor-not-allowed",
        className,
      )}
      aria-label={recording ? t.voice.stopAria : t.voice.startAria}
    >
      {transcribing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : recording ? (
        <Square className="h-3.5 w-3.5" fill="currentColor" />
      ) : (
        <Mic className="h-3.5 w-3.5" />
      )}
    </button>
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
