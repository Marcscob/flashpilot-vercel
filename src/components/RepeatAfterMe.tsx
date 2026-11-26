import { T } from "@/lib/i18n-ui";
/**
 * Modo T("Repita depois de mim"): ao PilotAI propõe uma frase curta, o aluno repete pelo
 * microfone e o app compara palavra por palavra. As frases ficam guardadas para
 * repraticar depois, o que evita chamar ao PilotAI de novo para o mesmo conteúdo.
 *
 * Reaproveita o que já existe: TTS (speak/primeSpeech/stopSpeaking), MicButton,
 * SpeakButton e a mesma server function da conversa.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastAiError, friendlyAiError } from "@/lib/ai-error-toast";
import { Loader2, RotateCcw, SkipForward, Trash2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SpeakButton } from "@/components/SpeakButton";
import { MicButton } from "@/components/MicButton";
import { languageChatReply } from "@/lib/language-chat.functions";
import { compareRepeat, repeatFeedback, type RepeatComparison } from "@/lib/repeat-compare";
import {
  deletePhrase,
  listPhrases,
  recordAttempt,
  savePhrase,
  type RepeatPhrase,
} from "@/lib/language-repeat-store";
import { prefetchSpeech, primeSpeech, speak, stopSpeaking } from "@/lib/tts";
import { REPEAT_AUDIO_AHEAD, repeatAudioCandidates } from "@/lib/repeat-audio-window";

type Props = {
  lang: string;
  level: string;
  topic: string;
  /** Leitura automática: mesma preferência do botão "Voz ligada" da tela. */
  autoSpeak: boolean;
};

/** As frases tocam sozinhas; o ícone de som apenas silencia ou religa o áudio. */
const MUTE_KEY = "fp:repeat-tts:muted";

function getMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(MUTE_KEY) === "1";
}

export function RepeatAfterMe({ lang, level, topic, autoSpeak }: Props) {
  const qc = useQueryClient();
  const ask = useServerFn(languageChatReply);
  const [current, setCurrent] = useState<RepeatPhrase | null>(null);
  const [attempt, setAttempt] = useState<{ spoken: string; result: RepeatComparison } | null>(null);
  const [muted, setMuted] = useState(false);
  const autoRef = useRef(true);
  autoRef.current = !muted;
  type PreparedPhrase = { phrase: RepeatPhrase; actionId?: string; speechText?: string };
  const buffer = useRef<PreparedPhrase[]>([]);
  const visited = useRef(new Set<string>());
  const generation = useRef(0);
  const preparing = useRef<Promise<void> | null>(null);
  const audioInfo = useRef(new Map<string, PreparedPhrase>());
  const backgroundStopped = useRef(false);

  // Preferência salva só é lida depois da hidratação.
  useEffect(() => {
    setMuted(getMuted() || !autoSpeak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (typeof window !== "undefined") localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    if (next) {
      stopSpeaking();
    } else {
      primeSpeech();
      if (current) speakPhrase(current.text);
    }
  };

  const phrases = useQuery({
    queryKey: ["repeat-phrases", lang],
    queryFn: () => listPhrases(lang),
  });

  // Trocar idioma/nível/tema recomeça a prática, sem áudio pendurado.
  useEffect(() => {
    generation.current++;
    buffer.current = [];
    visited.current.clear();
    preparing.current = null;
    audioInfo.current.clear();
    backgroundStopped.current = false;
    stopSpeaking();
    setCurrent(null);
    setAttempt(null);
  }, [lang, level, topic]);

  useEffect(
    () => () => {
      generation.current++;
      stopSpeaking();
    },
    [],
  );

  const speakPhrase = (text: string, actionId?: string, identity = text) => {
    const info = audioInfo.current.get(identity);
    const authorizedAction = actionId ?? info?.actionId;
    void speak(info?.speechText || text, {
      lang,
      repeatText: identity,
      origin: authorizedAction ? "chat" : "student",
      ...(authorizedAction ? { actionId: authorizedAction } : {}),
    }).then((r) => {
      if (!r.ok && r.reason === "cloud-error") {
        toast.error(T("Não foi possível ler a frase em voz alta"), {
          description: friendlyAiError(r.message).text,
        });
      }
    });
  };

  // One producer shared by foreground navigation and background warming.
  // Never create overlapping phrases or automatically retry a failed window.
  const prepareOne = async () => {
    if (preparing.current) return preparing.current;
    const epoch = generation.current;
    const valid = () => generation.current === epoch;
    const task = (async () => {
      const bank = await listPhrases(lang);
      if (!valid()) return;
      const excluded = new Set([...visited.current, ...buffer.current.map((p) => p.phrase.id)]);
      const saved = repeatAudioCandidates(bank, lang, level, topic, excluded)[0];
      let prepared: PreparedPhrase;
      if (saved) prepared = { phrase: saved };
      else {
        const used = [...bank, ...buffer.current.map((p) => p.phrase)]
          .slice(0, 12)
          .map((p) => ({ role: "assistant" as const, content: p.text }));
        const res = await ask({
          data: {
            lang,
            actionId: crypto.randomUUID(),
            level: level as "beginner" | "intermediate" | "advanced",
            topic,
            mode: "repeat",
            messages: [
              ...used,
              {
                role: "user",
                content: `Próxima frase para eu repetir, por favor. Crie uma frase nova e diferente de TODAS as frases acima. Não repita frases já propostas. Tema: ${topic || "livre"}.`,
              },
            ],
          },
        });
        if (!valid()) return;
        const text = res.reply.replace(/^["'“”]+|["'“”]+$/g, "").trim();
        if (!text) throw new Error(T("O PilotAI não enviou nenhuma frase. Tente novamente."));
        prepared = {
          phrase: await savePhrase(lang, text, level, topic),
          actionId: res.speechText ? res.actionId : undefined,
          speechText: res.speechText || undefined,
        };
        if (excluded.has(prepared.phrase.id))
          throw new Error(T("O PilotAI não enviou nenhuma frase. Tente novamente."));
      }
      if (!valid()) return;
      audioInfo.current.set(prepared.phrase.text, prepared);
      await prefetchSpeech(prepared.speechText || prepared.phrase.text, lang, valid, {
        repeatText: prepared.phrase.text,
        origin: prepared.actionId ? "chat" : "student",
        actionId: prepared.actionId,
      });
      if (!valid()) return;
      buffer.current.push(prepared);
      void qc.invalidateQueries({ queryKey: ["repeat-phrases", lang] });
    })();
    preparing.current = task;
    try {
      await task;
    } finally {
      if (preparing.current === task) preparing.current = null;
    }
  };

  const fillAhead = async () => {
    const epoch = generation.current;
    try {
      while (
        generation.current === epoch &&
        !backgroundStopped.current &&
        buffer.current.length < REPEAT_AUDIO_AHEAD
      )
        await prepareOne();
    } catch (error) {
      if (generation.current !== epoch || backgroundStopped.current) return;
      backgroundStopped.current = true;
      toastAiError(error instanceof Error ? error : new Error(String(error)), { persistent: true });
    }
  };

  const nextPhrase = useMutation({
    mutationFn: async () => {
      const epoch = generation.current;
      backgroundStopped.current = false; // Fresh user action, not an automatic retry.
      if (!buffer.current.length) await prepareOne();
      if (epoch !== generation.current) return undefined;
      return buffer.current.shift();
    },
    onSuccess: (prepared) => {
      if (!prepared) return;
      const { phrase, actionId, speechText } = prepared;
      visited.current.add(phrase.id);
      setCurrent(phrase);
      setAttempt(null);
      qc.invalidateQueries({ queryKey: ["repeat-phrases", lang] });
      if (autoRef.current) speakPhrase(speechText || phrase.text, actionId, phrase.text);
      void fillAhead();
    },
    onError: (e: Error) => toastAiError(e, { persistent: true }),
  });

  const evaluate = useMutation({
    mutationFn: async ({ phrase, spoken }: { phrase: RepeatPhrase; spoken: string }) => {
      const result = compareRepeat(phrase.text, spoken);
      await recordAttempt(phrase.id, result.score);
      return { spoken, result };
    },
    onSuccess: (data) => {
      setAttempt(data);
      qc.invalidateQueries({ queryKey: ["repeat-phrases", lang] });
    },
    onError: (e: Error) => toastAiError(e),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePhrase(id),
    onSuccess: (_r, id) => {
      visited.current.add(id);
      buffer.current = buffer.current.filter((p) => p.phrase.id !== id);
      if (current?.id === id) {
        setCurrent(null);
        setAttempt(null);
      }
      qc.invalidateQueries({ queryKey: ["repeat-phrases", lang] });
    },
    onError: (e: Error) => toastAiError(e),
  });

  const start = () => {
    primeSpeech();
    nextPhrase.mutate();
  };

  const practiceAgain = (phrase: RepeatPhrase) => {
    primeSpeech();
    stopSpeaking();
    setCurrent(phrase);
    setAttempt(null);
    visited.current.add(phrase.id);
    buffer.current = buffer.current.filter((p) => p.phrase.id !== phrase.id);
    if (autoRef.current) speakPhrase(phrase.text);
    void fillAhead();
  };

  return (
    <div className="space-y-4">
      {!current && (
        <Card className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground select-none">
            {T(
              "O FlashPilot diz uma frase e você repete em voz alta pelo microfone. Depois o app mostra o que entendeu e destaca as diferenças.",
            )}
          </p>
          <Button onClick={start} disabled={nextPhrase.isPending}>
            {nextPhrase.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> {T("Preparando…")}
              </>
            ) : (
              T("Começar")
            )}
          </Button>
        </Card>
      )}

      {current && (
        <Card className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {T("Repita depois de mim")}
          </p>
          <p className="text-lg font-medium leading-snug select-none">{current.text}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              aria-label={
                muted
                  ? T("Som desligado — toque para ouvir")
                  : T("Som ligado — toque para silenciar")
              }
              title={
                muted
                  ? T("Som desligado — toque para ouvir")
                  : T("Som ligado — toque para silenciar")
              }
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <MicButton
              value=""
              onChange={() => {}}
              lang={lang}
              onDictated={(text) => evaluate.mutate({ phrase: current, spoken: text })}
            />
            <span className="text-xs text-muted-foreground select-none">
              {T("Toque no microfone, repita e toque em parar.")}
            </span>
          </div>

          {evaluate.isPending && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {T("Comparando…")}
            </p>
          )}

          {attempt && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-sm font-semibold text-primary select-none">
                {T("{score}% de acerto — {feedback}", {
                  score: attempt.result.score,
                  feedback: repeatFeedback(attempt.result.score),
                })}
              </p>
              <p className="text-sm flex flex-wrap gap-x-1.5 gap-y-1 select-none">
                {attempt.result.tokens.map((tk, i) => (
                  <span
                    key={`${tk.text}-${i}`}
                    className={
                      tk.status === "ok"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : tk.status === "extra"
                          ? "text-amber-600 dark:text-amber-400 line-through"
                          : "text-destructive font-medium"
                    }
                  >
                    {tk.text}
                  </span>
                ))}
              </p>
              <p className="text-xs text-muted-foreground select-none">
                {T("Você disse: {spoken}", { spoken: attempt.spoken })}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => practiceAgain(current)}>
              <RotateCcw className="h-4 w-4 mr-1" /> {T("Repetir esta frase")}
            </Button>
            <Button size="sm" onClick={start} disabled={nextPhrase.isPending}>
              {nextPhrase.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <SkipForward className="h-4 w-4 mr-1" />
              )}
              {T("Próxima frase")}
            </Button>
          </div>
        </Card>
      )}

      {(phrases.data?.length ?? 0) > 0 && (
        <Card className="p-3 space-y-1">
          <p className="text-xs uppercase text-muted-foreground mb-1">
            {T("Frases já praticadas")}
          </p>
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {phrases.data?.map((p) => {
              const times = p.times_practiced ?? 0;
              const countLabel =
                times === 0
                  ? T("Frase ainda não praticada")
                  : times === 1
                    ? T("Frase praticada 1 vez")
                    : T("Frase praticada {n} vezes", { n: times });
              const tip =
                p.best_score !== null
                  ? `${countLabel} · ${T("Melhor acerto: {score}%", { score: p.best_score })}`
                  : countLabel;
              return (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => practiceAgain(p)}
                    className={`flex-1 text-left text-sm truncate rounded px-2 py-1 ${
                      p.id === current?.id
                        ? "bg-accent text-accent-foreground dark:text-white"
                        : "text-foreground dark:text-white hover:bg-accent/50"
                    }`}
                  >
                    <span>{p.text}</span>
                    <span className="opacity-85" title={tip} aria-label={tip}>
                      {" "}
                      · {times}x{p.best_score !== null ? ` · melhor ${p.best_score}%` : ""}
                    </span>
                  </button>
                  <SpeakButton
                    text={audioInfo.current.get(p.text)?.speechText || p.text}
                    repeatText={p.text}
                    lang={lang}
                    ariaLabel={T("Ouvir a frase")}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={T("Excluir frase")}
                    onClick={() => remove.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
