import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Maximize,
  Volume2,
  VolumeX,
  FileText,
  X,
  Tv,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { T } from "@/lib/i18n-ui";
import { primeSpeech, speak, speakVideoWithBrowserVoice, stopSpeaking } from "@/lib/tts";
import { supabase } from "@/integrations/supabase/client";
import { isYouTube, type TvScene, type TvStyle } from "@/lib/card-video";
import {
  audioTimeForVideoPosition,
  videoNarration,
  videoPositionForAudioTime,
} from "@/lib/card-video-audio";

export type TvSource =
  | {
      kind: "generated";
      id: string;
      scenes: TvScene[];
      lang: string;
      style: TvStyle;
      transcript: string;
      transcriptNote: string | null;
    }
  | {
      kind: "preview";
      audioUrl: string | null;
      scenes: TvScene[];
      lang: string;
      style: TvStyle;
      transcript: string;
      transcriptNote: null;
    }
  | { kind: "link"; url: string };

function sceneSeconds(s: TvScene) {
  return Math.max(5, Math.round(s.speech.split(/\s+/).length / 2.4) + 1);
}

/** 5 piscadas de .7s, com folga para a última terminar antes de esconder o aviso. */
const HINT_BLINKS_MS = 6000;

/** In-card FlashPilot-TV player. Starts with sound on; narration uses the PilotAI reader (same TTS rules as cards). */
export function FlashPilotTv({
  source,
  onClose,
  onDeleted,
}: {
  source: TvSource;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [showTx, setShowTx] = useState(false);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const fullscreen = () => boxRef.current?.requestFullscreen?.().catch(() => {});

  // On phones the delete icon sits by the title so a finger tapping "close" cannot hit it.
  const deleteButton = (extra: string) => {
    if (source.kind !== "generated" || !onDeleted) return null;
    const cardVideoId = source.id;
    const afterDelete = onDeleted;
    return (
      <button
        type="button"
        aria-label={T("Excluir vídeo")}
        title={T("Excluir vídeo")}
        className={`rounded-full p-1.5 hover:bg-card-back-foreground/10 sm:p-1 ${extra}`}
        onClick={async () => {
          const { error } = await supabase.from("card_videos").delete().eq("id", cardVideoId);
          if (error) toast.error(error.message);
          else afterDelete();
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  };

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col rounded-3xl bg-card-back p-3 text-card-back-foreground"
      onClick={stop}
      onPointerDown={stop}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1 text-xs font-bold tracking-wider">
          <Tv className="h-4 w-4 shrink-0" /> FlashPilot-TV
          {source.kind === "generated" && onDeleted && deleteButton("ml-2 shrink-0 sm:hidden")}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {source.kind === "generated" && onDeleted && deleteButton("hidden sm:inline-flex")}
          <button
            type="button"
            aria-label={T("Fechar")}
            onClick={() => {
              stopSpeaking();
              onClose();
            }}
            className="rounded-full p-1 hover:bg-card-back-foreground/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-brand-graphite text-brand-on-graphite"
      >
        {source.kind === "link" ? (
          <LinkVideo url={source.url} />
        ) : (
          <GeneratedVideo
            source={source}
            onTranscript={() => setShowTx(true)}
            onFullscreen={fullscreen}
          />
        )}
        {source.kind === "link" && (
          <button
            type="button"
            onClick={fullscreen}
            aria-label={T("Tela cheia")}
            className="absolute bottom-2 right-2 rounded-full bg-brand-on-graphite/80 p-1.5 text-brand-graphite"
          >
            <Maximize className="h-4 w-4" />
          </button>
        )}
      </div>
      {showTx && source.kind !== "link" && (
        <TranscriptModal source={source} onClose={() => setShowTx(false)} />
      )}
    </div>
  );
}

function LinkVideo({ url }: { url: string }) {
  const yt = isYouTube(url);
  if (yt) {
    return (
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1&rel=0`}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        title="FlashPilot-TV"
      />
    );
  }
  return (
    <video
      className="h-full w-full bg-brand-graphite object-contain"
      src={url}
      controls
      autoPlay
      playsInline
      preload="metadata"
    />
  );
}

function GeneratedVideo({
  source,
  onTranscript,
  onFullscreen,
}: {
  source: Exclude<TvSource, { kind: "link" }>;
  onTranscript: () => void;
  onFullscreen: () => void;
}) {
  const scenes = source.scenes;
  const durs = useMemo(() => scenes.map(sceneSeconds), [scenes]);
  const total = durs.reduce((a, b) => a + b, 0);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const spoken = useRef(-1);
  const [audioReady, setAudioReady] = useState(false);
  const run = useRef(0);
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const timeRef = useRef(t);
  const totalRef = useRef(total);
  const volumeRef = useRef(volume);
  const previewAudioUrl = source.kind === "preview" ? source.audioUrl : null;

  let idx = 0,
    acc = 0;
  for (let i = 0; i < durs.length; i++) {
    idx = i;
    if (t < acc + durs[i]) break;
    acc += durs[i];
  }
  useEffect(() => {
    timeRef.current = t;
  }, [t]);
  useEffect(() => {
    totalRef.current = total;
  }, [total]);

  // As cenas só avançam quando a narração já está tocando (ou sem som).
  const advancing = playing && (muted || audioReady);
  useEffect(() => {
    if (!advancing) return;
    // Com áudio gravado, o relógio do vídeo segue o próprio áudio e só termina
    // quando a narração acaba — nunca corta o finalzinho.
    const id = setInterval(
      () =>
        setT((v) => {
          const a = !muted ? audioEl.current : null;
          if (a) {
            if (a.ended) {
              setPlaying(false);
              return total;
            }
            const position = videoPositionForAudioTime(a.currentTime, a.duration, total);
            if (position !== null) return Math.min(total - 0.01, position);
          }
          const n = v + 0.1;
          if (n >= total) {
            setPlaying(false);
            return total;
          }
          return n;
        }),
      100,
    );
    return () => clearInterval(id);
  }, [advancing, total, muted]);

  // Narração em UMA chamada (texto restante a partir da cena atual), preservando
  // a leitura bilíngue. Se a trava de operação única ainda estiver ocupada,
  // espera e tenta de novo algumas vezes, sem mostrar erro ao aluno.
  useEffect(() => {
    const nativeOnly = source.kind === "preview" && !previewAudioUrl;
    if ((source.kind === "preview" && !nativeOnly) || !playing || muted || spoken.current !== -1)
      return;
    spoken.current = idx;
    const myRun = ++run.current;
    const text = videoNarration(scenes);
    // Última etapa: voz do navegador no idioma do vídeo; sem voz, avisa e segue mudo.
    const browserVoice = async () => {
      const ok = await speakVideoWithBrowserVoice(text, source.lang);
      if (run.current !== myRun) return;
      if (ok) {
        toast.info(T("Narração com a voz do navegador."));
        setAudioReady(true);
        return;
      }
      toast.error(T("Narração indisponível no momento. Toque no som para tentar de novo."));
      setMuted(true);
    };
    if (nativeOnly) {
      void browserVoice();
      return;
    }
    const attempt = async (left: number, retried = false) => {
      if (source.kind !== "generated") return;
      const r = await speak(text, { lang: source.lang, videoId: source.id });
      if (run.current !== myRun) return;
      if (r.ok) {
        if (r.source === "cloud") {
          r.audio.volume = volumeRef.current;
          audioEl.current = r.audio;
          const syncPosition = () => {
            const audioTime = audioTimeForVideoPosition(
              timeRef.current,
              totalRef.current,
              r.audio.duration,
            );
            if (audioTime !== null) r.audio.currentTime = audioTime;
          };
          if (r.audio.readyState >= 1) syncPosition();
          else r.audio.addEventListener("loadedmetadata", syncPosition, { once: true });
        }
        setAudioReady(true);
        return;
      }
      const msg = "message" in r ? (r.message ?? "") : "";
      if (/Outra operação do PilotAI/i.test(msg) && left > 0) {
        await new Promise((res) => setTimeout(res, 15000));
        if (run.current === myRun) void attempt(left - 1);
        return;
      }
      if (!retried) {
        await new Promise((res) => setTimeout(res, 2000));
        if (run.current === myRun) void attempt(left, true);
        return;
      }
      await browserVoice();
    };
    void attempt(4);
  }, [idx, playing, muted, scenes, source, previewAudioUrl]);

  useEffect(() => {
    if (!previewAudioUrl) return;
    const audio = new Audio(previewAudioUrl);
    audio.volume = volumeRef.current;
    audioEl.current = audio;
    const syncPosition = () => {
      const audioTime = audioTimeForVideoPosition(
        timeRef.current,
        totalRef.current,
        audio.duration,
      );
      if (audioTime !== null) audio.currentTime = audioTime;
    };
    const onEnded = () => {
      setPlaying(false);
      setT(total);
    };
    audio.addEventListener("loadedmetadata", syncPosition, { once: true });
    if (audio.readyState >= 1) syncPosition();
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", syncPosition);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      if (audioEl.current === audio) audioEl.current = null;
    };
  }, [previewAudioUrl, total]);

  useEffect(() => {
    if (!playing || muted) {
      run.current++;
      stopSpeaking();
      if (source.kind === "preview") audioEl.current?.pause();
      else {
        if (audioEl.current) audioEl.current.volume = 1;
        audioEl.current = null;
      }
      spoken.current = -1;
      setAudioReady(false);
    }
  }, [playing, muted, source.kind]);
  useEffect(
    () => () => {
      if (audioEl.current) audioEl.current.volume = 1;
      stopSpeaking();
    },
    [],
  );

  // O aviso da primeira reprodução pisca 5 vezes e depois fica como texto de leitura comum.
  const [hintStartedAt, setHintStartedAt] = useState<number | null>(null);
  const [hintExpired, setHintExpired] = useState(false);
  useEffect(() => {
    if (playing && !muted && !audioReady && hintStartedAt === null) setHintStartedAt(Date.now());
  }, [playing, muted, audioReady, hintStartedAt]);
  useEffect(() => {
    if (hintStartedAt === null || hintExpired) return;
    const left = HINT_BLINKS_MS - (Date.now() - hintStartedAt);
    if (left <= 0) {
      setHintExpired(true);
      return;
    }
    const id = setTimeout(() => setHintExpired(true), left);
    return () => clearTimeout(id);
  }, [hintStartedAt, hintExpired]);
  const hintShowing =
    source.kind === "generated" &&
    playing &&
    !muted &&
    (!audioReady || (hintStartedAt !== null && !hintExpired));

  const toggle = () => {
    if (source.kind === "preview" && previewAudioUrl) {
      const audio = audioEl.current;
      if (playing) audio?.pause();
      else if (!muted && audio) {
        if (t >= total) audio.currentTime = 0;
        void audio
          .play()
          .then(() => setAudioReady(true))
          .catch((error: unknown) => {
            if (!(error instanceof Error && error.name === "NotAllowedError")) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : T("Ocorreu um erro ao processar o seu material. Por favor, tente novamente."),
              );
            }
            setMuted(true);
          });
      }
    } else if (!playing && !muted) primeSpeech();
    if (t >= total) {
      setT(0);
      spoken.current = -1;
    }
    setPlaying((p) => !p);
  };
  const seekTo = (requestedPosition: number) => {
    const position = Number.isFinite(requestedPosition)
      ? Math.min(total, Math.max(0, requestedPosition))
      : 0;
    timeRef.current = position;
    setT(position);

    const audio = audioEl.current;
    if (audio) {
      const audioTime = audioTimeForVideoPosition(position, total, audio.duration);
      if (audioTime !== null) audio.currentTime = audioTime;
    }

    if (position >= total) setPlaying(false);
  };
  const changeVolume = (nextVolume: number) => {
    const next = Math.min(1, Math.max(0, nextVolume));
    volumeRef.current = next;
    setVolume(next);
    if (audioEl.current) audioEl.current.volume = next;
  };
  const scene = scenes[idx];
  const showAvatar = source.style !== "motion";
  const showText = source.style !== "avatar";

  return (
    <>
      <style>{`
        @keyframes tvUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes tvPop{0%{opacity:0;transform:scale(.4)}70%{transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
        @keyframes tvBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        .tv-up{opacity:0;animation:tvUp .6s ease forwards}.tv-pop{animation:tvPop .7s ease forwards}
        @keyframes tvHintBlink{0%,100%{color:inherit;text-shadow:none}50%{color:var(--destructive);text-shadow:0 0 10px var(--destructive)}}
        .tv-hint{animation:tvHintBlink .7s ease-in-out 8 forwards}
        @media (prefers-reduced-motion: reduce){.tv-hint{animation:none;opacity:1}}

        .tv-paused *{animation-play-state:paused!important}
      `}</style>
      <div className="flex gap-1 p-2">
        {durs.map((d, i) => {
          const start = durs.slice(0, i).reduce((a, x) => a + x, 0);
          const p = Math.min(1, Math.max(0, (t - start) / d));
          return (
            <div key={i} className="h-1 flex-1 rounded bg-brand-on-graphite/30">
              <div
                className="h-full rounded bg-brand-on-graphite"
                style={{ width: `${p * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div
        key={idx}
        className={`flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 ${playing ? "" : "tv-paused"}`}
      >
        {t === 0 && !playing ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={T("Reproduzir")}
            className="rounded-full bg-brand-on-graphite/20 p-5"
          >
            <Play className="h-10 w-10" />
          </button>
        ) : (
          <div className="flex w-full flex-col items-center gap-2 text-center">
            <div className="tv-pop text-4xl">{scene.emoji}</div>
            {scene.questionRecap && (
              <div className="tv-up w-full rounded-lg bg-brand-on-graphite/10 px-3 py-2 text-left text-sm leading-snug">
                {scene.questionRecap}
              </div>
            )}
            {scene.kicker && (
              <div className="tv-up text-[11px] font-semibold uppercase tracking-widest opacity-80">
                {scene.kicker}
              </div>
            )}
            {scene.title && (
              <div className="tv-up text-xl font-extrabold" style={{ animationDelay: ".3s" }}>
                {scene.title}
              </div>
            )}
            {showText &&
              scene.bullets.map((b, i) => (
                <div
                  key={i}
                  className="tv-up w-full rounded-lg bg-brand-on-graphite/15 px-3 py-1.5 text-sm"
                  style={{ animationDelay: `${0.8 + i * 0.8}s` }}
                >
                  {b}
                </div>
              ))}
            {!showText && (
              <div className="tv-up text-sm italic opacity-90" style={{ animationDelay: ".8s" }}>
                {scene.speech}
              </div>
            )}
          </div>
        )}
      </div>
      {showAvatar && (
        <div
          className={`pointer-events-none absolute right-3 text-4xl ${hintShowing ? "bottom-24" : "bottom-14"}`}
          style={{ animation: playing ? "tvBob 1.6s ease-in-out infinite" : undefined }}
        >
          👩‍🎓
        </div>
      )}
      {/* Primeira reprodução: enquanto a narração é preparada, explicar o que está acontecendo. */}
      {hintShowing && (
        <div
          role="status"
          className="tv-hint mx-3 mb-2 rounded-xl bg-brand-on-graphite/15 px-3 py-2 text-center text-[11px] leading-snug"
        >
          {T(
            "Reproduza o vídeo até o fim para que seja registrado no seu flashcard. Na próxima reprodução o vídeo será instantâneo.",
          )}
        </div>
      )}

      <div className="space-y-1 bg-brand-graphite-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggle} aria-label={T("Reproduzir/pausar")}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              if (muted && source.kind === "preview" && playing) {
                void audioEl.current?.play().then(() => setAudioReady(true));
              } else if (muted && source.kind !== "preview") {
                primeSpeech();
              }
              setMuted((m) => !m);
            }}
            aria-label={T("Som")}
          >
            {muted || volume === 0 ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => changeVolume(Number(event.currentTarget.value))}
            aria-label={T("Som")}
            aria-valuetext={`${Math.round(volume * 100)}%`}
            className="w-14 shrink-0 cursor-pointer accent-brand-on-graphite sm:w-20"
          />
          <span className="text-xs tabular-nums">
            {Math.floor(t)}s / {total}s
          </span>
          <div className="flex-1" />
          {playing && !muted && !audioReady && (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="…" />
          )}
          <button type="button" onClick={onTranscript} aria-label={T("Transcrição do vídeo")}>
            <FileText className="h-5 w-5" />
          </button>
          <button type="button" onClick={onFullscreen} aria-label={T("Tela cheia")}>
            <Maximize className="h-5 w-5" />
          </button>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(total, 0.1)}
          step="0.1"
          value={Math.min(t, total)}
          onChange={(event) => seekTo(Number(event.currentTarget.value))}
          aria-label={T("Posição do vídeo")}
          aria-valuetext={`${Math.floor(t)}s / ${total}s`}
          className="h-3 w-full cursor-pointer accent-brand-on-graphite"
        />
      </div>
    </>
  );
}

function TranscriptModal({
  source,
  onClose,
}: {
  source: Exclude<TvSource, { kind: "link" }>;
  onClose: () => void;
}) {
  const [text, setText] = useState(source.transcriptNote ?? source.transcript);
  const [saving, setSaving] = useState(false);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-card p-5 text-card-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{T("Transcrição do vídeo")}</h2>
          <button type="button" onClick={onClose} aria-label={T("Fechar")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {source.kind === "preview" ? (
          <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-lg border bg-background p-3 text-sm leading-6">
            {source.transcript}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="w-full rounded-lg border bg-background p-3 text-sm"
          />
        )}
        {source.kind === "generated" && (
          <button
            type="button"
            disabled={saving}
            className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            onClick={async () => {
              setSaving(true);
              const { error } = await supabase
                .from("card_videos")
                .update({ transcript_note: text })
                .eq("id", source.id);
              setSaving(false);
              if (error) toast.error(error.message);
              else {
                source.transcriptNote = text;
                toast.success(T("Anotação do vídeo salva"));
              }
            }}
          >
            {T("Salvar como anotação do vídeo")}
          </button>
        )}
      </div>
    </div>
  );
}
