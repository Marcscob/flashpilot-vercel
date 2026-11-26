import { useEffect, useRef, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { Loader2, Speech, VolumeX } from "lucide-react";
import { useStudyT } from "@/lib/i18n-audit";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isSpeaking, speak, stopSpeaking } from "@/lib/tts";
import { languageLabel } from "@/lib/languages";

type Props = {
  text: string;
  variant?: "light" | "dark";
  className?: string;
  ariaLabel?: string;
  /** Idioma efetivo (Fase 2). Ausente/null = comportamento atual do app. */
  lang?: string | null;
  /** Velocidade da reprodução; ausente = preferência salva. */
  rate?: number;
  repeatText?: string;
  chatMessageId?: string;
};

export function SpeakButton({ text, variant = "light", className, ariaLabel, lang, rate, repeatText, chatMessageId }: Props) {
  const s0 = useStudyT();
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const iv = window.setInterval(() => {
      if (mountedRef.current) setSpeaking(isSpeaking());
    }, 300);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => () => stopSpeaking(), []);

  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        if (loading) return;
        if (speaking) {
          stopSpeaking();
          setSpeaking(false);
          return;
        }
        setLoading(true);
        let result: Awaited<ReturnType<typeof speak>>;
        try {
          result = await speak(text, { lang: lang ?? undefined, rate, repeatText, chatMessageId, ...(chatMessageId ? { origin: "chat" as const } : {}) });
        } finally {
          if (mountedRef.current) setLoading(false);
        }
        if (!mountedRef.current) return;
        if (result.ok) {
          setSpeaking(true);
          return;
        }
        setSpeaking(false);
        if (result.reason === "cloud-error") {
          toast.error(s0.narrateFail, { description: result.message });
        } else if (result.reason === "unsupported") {
          toast.error(s0.narrateUnsupported);
        } else if (result.reason === "no-voice") {
          toast.error(T("Voz não instalada neste aparelho"), {
            description: T("Instale a voz de {lang} nas configurações do sistema para ouvir a pronúncia.", { lang: languageLabel(result.lang) ?? result.lang ?? "" }),
          });
        }
      }}
      aria-label={ariaLabel ?? s0.narrate}
      aria-busy={loading}
      className={cn(
        "p-1.5 rounded-full transition",
        variant === "dark"
          ? "hover:bg-primary-foreground/15 text-primary-foreground"
          : "hover:bg-muted text-muted-foreground",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : speaking ? <VolumeX className="h-4 w-4" /> : <Speech className="h-4 w-4" />}
    </button>
  );
}
