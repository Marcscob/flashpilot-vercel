import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Maximize, Volume2, VolumeX, FileText, X, Tv } from "lucide-react";
import { T } from "@/lib/i18n-ui";

export const Route = createFileRoute("/tv-demo")({
  head: () => ({
    meta: [
      { title: T("FlashPilot-TV — Simulação") },
      {
        name: "description",
        content: T("Simulação do microvídeo dinâmico FlashPilot-TV em um flashcard."),
      },
      { property: "og:title", content: T("FlashPilot-TV — Simulação") },
      {
        property: "og:description",
        content: T("Microvídeo animado com narração gerado a partir de um flashcard."),
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TvDemo,
});

type Scene = { dur: number; speech: string; render: () => React.ReactNode };

const SCENES: Scene[] = [
  {
    dur: 5,
    speech: "Você sabe quais dispositivos garantem a reserva legal no Brasil?",
    render: () => (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="tv-pop text-5xl">⚖️</div>
        <div className="tv-up text-xs font-semibold uppercase tracking-widest opacity-80">
          {T("Direito Penal · Constitucional")}
        </div>
        <div className="tv-up text-2xl font-extrabold" style={{ animationDelay: ".4s" }}>
          {T("Reserva Legal")}
        </div>
      </div>
    ),
  },
  {
    dur: 9,
    speech:
      "Ela exige lei prévia. Não há crime sem lei anterior que o defina, nem pena sem prévia cominação legal.",
    render: () => (
      <div className="flex flex-col gap-3">
        <div className="tv-up text-lg font-bold">
          {T("Exige")} <span className="tv-glow">{T("LEI PRÉVIA")}</span> {T("para:")}
        </div>
        <div
          className="tv-up rounded-lg bg-background/15 px-3 py-2"
          style={{ animationDelay: ".8s" }}
        >
          {T("▶ Tipificar crimes")}
        </div>
        <div
          className="tv-up rounded-lg bg-background/15 px-3 py-2"
          style={{ animationDelay: "1.6s" }}
        >
          {T("▶ Aplicar penas")}
        </div>
        <div className="tv-up text-sm italic opacity-90" style={{ animationDelay: "3s" }}>
          "{T("Não há crime sem lei anterior… nem pena sem prévia cominação.")}"
        </div>
      </div>
    ),
  },
  {
    dur: 9,
    speech:
      "Guarde os dois dispositivos: artigo quinto, inciso trinta e nove, da Constituição. E artigo primeiro do Código Penal.",
    render: () => (
      <div className="flex flex-col items-center gap-4">
        <div className="tv-up text-sm font-semibold uppercase tracking-widest opacity-80">
          {T("Guarde")}
        </div>
        <div className="tv-stamp rounded-xl border-2 border-primary-foreground px-4 py-2 text-lg font-extrabold">
          {T("Art. 5º, XXXIX · CF/88")}
        </div>
        <div
          className="tv-stamp rounded-xl border-2 border-primary-foreground px-4 py-2 text-lg font-extrabold"
          style={{ animationDelay: "2.5s" }}
        >
          {T("Art. 1º · Código Penal")}
        </div>
      </div>
    ),
  },
];
const TOTAL = SCENES.reduce((s, x) => s + x.dur, 0);
function TvDemo() {
  const [tv, setTv] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [t, setT] = useState(0);
  const [showTx, setShowTx] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const spoken = useRef(-1);

  let acc = 0,
    idx = 0;
  for (let i = 0; i < SCENES.length; i++) {
    if (t < acc + SCENES[i].dur) {
      idx = i;
      break;
    }
    acc += SCENES[i].dur;
    idx = i;
  }

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () =>
        setT((v) => {
          const n = v + 0.1;
          if (n >= TOTAL) {
            setPlaying(false);
            return TOTAL;
          }
          return n;
        }),
      100,
    );
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (!playing || muted || spoken.current === idx || typeof speechSynthesis === "undefined")
      return;
    spoken.current = idx;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(T(SCENES[idx].speech));
    u.lang = document.documentElement.lang || "pt-BR";
    const lang = u.lang.split("-")[0]!.toLowerCase();
    const v = speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }, [idx, playing, muted]);

  useEffect(() => {
    if (!playing || muted) {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      spoken.current = -1;
    }
  }, [playing, muted]);

  const toggle = () => {
    if (t >= TOTAL) setT(0);
    setPlaying((p) => !p);
  };
  const close = () => {
    setTv(false);
    setPlaying(false);
    setT(0);
  };
  const transcript = SCENES.map((scene) => T(scene.speech)).join("\n\n");

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <style>{`
        @keyframes tvUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes tvPop{0%{opacity:0;transform:scale(.4)}70%{transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}
        @keyframes tvStamp{0%{opacity:0;transform:scale(2.2) rotate(-8deg)}100%{opacity:1;transform:scale(1) rotate(-2deg)}}
        @keyframes tvGlow{0%,100%{text-shadow:0 0 0 transparent}50%{text-shadow:0 0 14px currentColor}}
        .tv-up{opacity:0;animation:tvUp .6s ease forwards}.tv-pop{animation:tvPop .7s ease forwards}
        .tv-stamp{opacity:0;animation:tvStamp .5s cubic-bezier(.2,1.6,.4,1) forwards}
        .tv-glow{animation:tvGlow 1.4s ease-in-out infinite;text-decoration:underline}
        .tv-paused *{animation-play-state:paused!important}
      `}</style>
      <div className="mx-auto max-w-md">
        <p className="mb-3 text-center text-sm text-muted-foreground">
          {T("Simulação · verso do card")}
        </p>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
          <div className="border-b p-4 text-sm font-medium">
            {T(
              "Quais dispositivos consagram o princípio da reserva legal no ordenamento jurídico brasileiro?",
            )}
          </div>

          {!tv ? (
            <div className="space-y-3 p-4">
              <p className="font-semibold">
                {T("Art. 5º, XXXIX da CF e Art. 1º do Código Penal.")}
              </p>
              <p className="text-sm text-muted-foreground">
                {T(
                  "O princípio da legalidade/reserva legal penal exige lei prévia para tipificação de crimes e aplicação de penas.",
                )}
              </p>
              <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                {T("Minha resposta…")}
              </div>
              <button
                onClick={() => setTv(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                <Tv className="h-4 w-4" /> {T("Assistir na FlashPilot-TV")}
              </button>
            </div>
          ) : (
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-bold tracking-wider text-primary">
                  <Tv className="h-4 w-4" /> FlashPilot-TV
                </span>
                <button
                  onClick={close}
                  aria-label={T("Fechar TV")}
                  className="rounded p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div
                ref={boxRef}
                className="relative flex aspect-[9/12] flex-col overflow-hidden rounded-xl bg-primary text-primary-foreground"
              >
                <div className="flex gap-1 p-2">
                  {SCENES.map((s, i) => {
                    const start = SCENES.slice(0, i).reduce((a, x) => a + x.dur, 0);
                    const p = Math.min(1, Math.max(0, (t - start) / s.dur));
                    return (
                      <div key={i} className="h-1 flex-1 rounded bg-primary-foreground/30">
                        <div
                          className="h-full rounded bg-primary-foreground"
                          style={{ width: `${p * 100}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  key={idx}
                  className={`flex flex-1 items-center justify-center px-6 ${playing ? "" : "tv-paused"}`}
                >
                  {t === 0 && !playing ? (
                    <button onClick={toggle} className="rounded-full bg-primary-foreground/20 p-5">
                      <Play className="h-10 w-10" />
                    </button>
                  ) : (
                    SCENES[idx].render()
                  )}
                </div>
                <div
                  className="absolute bottom-16 right-3 text-4xl"
                  style={{ animation: playing ? "tvGlow 2s infinite" : undefined }}
                >
                  👩‍🎓
                </div>
                {muted && playing && (
                  <button
                    onClick={() => setMuted(false)}
                    className="absolute left-1/2 top-8 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs text-foreground"
                  >
                    🔇 {T("Toque para ativar o som")}
                  </button>
                )}
                <div className="flex items-center gap-3 bg-foreground/30 px-3 py-2">
                  <button onClick={toggle} aria-label={T("Reproduzir/pausar")}>
                    {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button onClick={() => setMuted((m) => !m)} aria-label={T("Som")}>
                    {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <span className="text-xs tabular-nums">
                    {Math.floor(t)}s / {TOTAL}s
                  </span>
                  <div className="flex-1" />
                  <button onClick={() => setShowTx(true)} aria-label={T("Transcrição")}>
                    <FileText className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => boxRef.current?.requestFullscreen?.()}
                    aria-label={T("Tela cheia")}
                  >
                    <Maximize className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {T(
            "A voz desta simulação é a do navegador; na versão real será a voz feminina do PilotAI.",
          )}
        </p>
      </div>

      {showTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          onClick={() => setShowTx(false)}
        >
          <div
            className="max-w-md rounded-xl bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">{T("Transcrição do vídeo")}</h2>
              <button onClick={() => setShowTx(false)} aria-label={T("Fechar")}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="whitespace-pre-line text-sm">{transcript}</p>
            <button className="mt-4 w-full rounded-lg border px-3 py-2 text-sm">
              {T("Salvar como anotação do vídeo")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
