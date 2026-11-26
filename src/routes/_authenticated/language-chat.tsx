import { useAuditT } from "@/lib/i18n-audit";
import { T } from "@/lib/i18n-ui";
import { useLang } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SpeakButton } from "@/components/SpeakButton";
import { MicButton } from "@/components/MicButton";
import { LanguageSelect } from "@/components/LanguageSelect";
import { CreateCardFromChatDialog } from "@/components/CreateCardFromChatDialog";
import { RepeatAfterMe } from "@/components/RepeatAfterMe";
import { toast } from "sonner";
import { toastAiError, friendlyAiError } from "@/lib/ai-error-toast";
import { ArrowLeft, Loader2, Plus, Send, Sparkles, Trash2, Volume2, VolumeX } from "lucide-react";
import { languageChatReply } from "@/lib/language-chat.functions";
import { useAiBillingInfo } from "@/hooks/useAiBillingInfo";
import { DEFAULT_LANGUAGE, languageFlag, languageName } from "@/lib/languages";
import { FlagIcon } from "@/components/FlagIcon";
import { supabase } from "@/integrations/supabase/client";
import { primeSpeech, speak, stopSpeaking, prefetchSpeech } from "@/lib/tts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHAT_LEVELS,
  CHAT_MODES,
  DEFAULT_LEVEL,
  DEFAULT_MODE,
  DEFAULT_TOPIC,
  SELECTABLE_CHAT_TOPICS,
  findMode,
  levelLabel,
  modeLabel,
  findLevel,
  topicLabel,
} from "@/lib/language-chat-config";
import {
  appendMessage,
  createSession,
  deleteSession,
  listMessages,
  listSessions,
  titleFromFirstMessage,
  type ChatMessage,
} from "@/lib/language-chat-store";

type ChatLevelId = (typeof CHAT_LEVELS)[number]["id"];
type ChatModeId = (typeof CHAT_MODES)[number]["id"];
const NO_SUBJECT = "__none__";

/** Leitura automática das respostas do PilotAI: ligada por padrão, silenciável aqui. */
const CHAT_AUTO_KEY = "fp:chat-tts:auto";

function getChatAutoPlay(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(CHAT_AUTO_KEY) !== "0";
}

function setChatAutoPlay(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_AUTO_KEY, v ? "1" : "0");
}

/** Fase 18 — o card manda a frase a praticar por aqui. */
type ChatSearch = { practice?: string; lang?: string };

export const Route = createFileRoute("/_authenticated/language-chat")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    practice:
      typeof search["practice"] === "string"
        ? (search["practice"] as string).slice(0, 500)
        : undefined,
    lang: typeof search["lang"] === "string" ? (search["lang"] as string).slice(0, 10) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Conversação em idiomas — FlashPilot" },
      {
        name: "description",
        content: "Pratique conversação no idioma da sua matéria com áudio e correções.",
      },
      { property: "og:title", content: "Conversação em idiomas — FlashPilot" },
      {
        property: "og:description",
        content: "Pratique conversação no idioma da sua matéria com áudio e correções.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LanguageChatPage,
});

/** Fase 14 — correção mostrada à parte da conversa, em tom amigável. */
type Correction = {
  original?: string;
  corrected: string;
  explanation?: string;
  better?: string;
};

function correctionOf(value: unknown): Correction | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  return typeof c["corrected"] === "string" && c["corrected"].trim()
    ? {
        corrected: c["corrected"] as string,
        ...(typeof c["original"] === "string" ? { original: c["original"] as string } : {}),
        ...(typeof c["explanation"] === "string"
          ? { explanation: c["explanation"] as string }
          : {}),
        ...(typeof c["better"] === "string" ? { better: c["better"] as string } : {}),
      }
    : null;
}

function CorrectionBox({ correction, lang }: { correction: Correction; lang: string }) {
  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {T("Correção amigável")}
      </p>
      {correction.original && (
        <p className="text-muted-foreground select-none">
          {T("Você escreveu:")} <span className="line-through">{correction.original}</span>
        </p>
      )}
      <p className="select-none">
        {T("Forma correta:")} <strong>{correction.corrected}</strong>
      </p>
      {correction.explanation && (
        <p className="text-muted-foreground select-none">{correction.explanation}</p>
      )}
      {correction.better && (
        <p className="select-none">
          {T("Mais natural:")} <strong>{correction.better}</strong>
        </p>
      )}
      <div className="pt-1">
        <SpeakButton
          text={correction.better || correction.corrected}
          lang={lang}
          ariaLabel="Narrar forma correta"
        />
      </div>
    </div>
  );
}

function LanguageChatPage() {
  const search = Route.useSearch();
  const a = useAuditT();
  const qc = useQueryClient();
  const send = useServerFn(languageChatReply);
  const billing = useAiBillingInfo();
  const { lang: uiLang } = useLang();
  // O seletor já abre no idioma da interface (ex.: interface em italiano →
  // conversa em italiano), evitando a divergência entre o rótulo exibido e
  // o valor interno que escondia o modo "Repita depois de mim".
  const initialLang =
    search.lang && search.lang !== DEFAULT_LANGUAGE
      ? search.lang
      : uiLang !== "pt" && uiLang !== "pt-PT"
        ? uiLang
        : null;
  const [lang, setLang] = useState<string | null>(initialLang);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingTurn, setPendingTurn] = useState<string | null>(null);
  // Fase 12 — matéria de origem, nível e tema da conversa.
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [level, setLevel] = useState<ChatLevelId>(DEFAULT_LEVEL);
  const [topic, setTopic] = useState<string>(DEFAULT_TOPIC);
  // Fase 13 — modo pedagógico da conversa.
  const [mode, setMode] = useState<ChatModeId>(DEFAULT_MODE);
  // Fase 17 — par pergunta/resposta escolhido para virar flashcard:
  // a frente é a minha mensagem e o verso é a resposta do PilotAI.
  const [cardDraft, setCardDraft] = useState<{ question: string; answer: string } | null>(null);
  // Leitura automática das respostas (ligada por padrão; o botão silencia).
  const [autoSpeak, setAutoSpeak] = useState(true);

  const effectiveLang = lang ?? DEFAULT_LANGUAGE;
  // "Repita depois de mim" fica disponível em todos os idiomas, inclusive
  // português — nunca some do menu por causa do idioma escolhido.
  const isRepeatMode = mode === "repeat";

  // Fase 18 — chegando do card: tema do flashcard, modo treino e frase no campo.
  const primed = useRef(false);
  useEffect(() => {
    if (primed.current || !search.practice) return;
    primed.current = true;
    setTopic("card");
    setMode("training");
    setDraft(`Quero praticar esta frase: "${search.practice}"`);
  }, [search.practice]);

  // Fase 22 — sair da tela (ou trocar de conversa) interrompe qualquer narração
  // em andamento, sem deixar áudio tocando em segundo plano.
  useEffect(() => () => stopSpeaking(), []);
  // Carrega a preferência de leitura automática salva neste navegador.
  useEffect(() => {
    setAutoSpeak(getChatAutoPlay());
  }, []);

  const sessions = useQuery({ queryKey: ["chat-sessions"], queryFn: listSessions });

  // Matérias com idioma definido: a conversa herda o idioma da matéria.
  const subjects = useQuery({
    queryKey: ["chat-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, language")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const messages = useQuery({
    queryKey: ["chat-messages", sessionId],
    queryFn: () => listMessages(sessionId as string),
    enabled: !!sessionId,
  });

  const turns: ChatMessage[] = messages.data ?? [];

  useEffect(() => {
    let active = true;
    const nearby = (messages.data ?? []).filter((turn) => turn.role === "assistant").slice(-3);
    void (async () => {
      for (const turn of nearby) {
        if (!active) break;
        try {
          // Download existing recordings only: opening a conversation never buys new narration.
          await prefetchSpeech(turn.content.slice(0, 4000), effectiveLang, () => active, {
            origin: "chat",
            chatMessageId: turn.id,
          });
        } catch {
          break;
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [messages.data, effectiveLang]);

  const ask = useMutation({
    mutationFn: async (text: string) => {
      // Conversa nova só é criada quando existe a primeira mensagem.
      const id =
        sessionId ??
        (await createSession(effectiveLang, titleFromFirstMessage(text), {
          subjectId,
          level,
          topic,
          mode,
        }));
      await appendMessage(id, "user", text);
      const history = [
        ...turns.map((t) => ({ role: t.role, content: t.content })),
        { role: "user" as const, content: text },
      ];
      const actionId = crypto.randomUUID();
      const res = await send({
        data: {
          lang: effectiveLang,
          sessionId: id,
          actionId,
          level,
          topic,
          mode,
          messages: history.slice(-20),
        },
      });
      // Fase 14 — a correção fica guardada junto da resposta, em campo próprio.
      await appendMessage(id, "assistant", res.reply, res.correction ?? null);
      return {
        id,
        reply: res.reply,
        speechText: res.speechText,
        actionId: res.actionId,
        billing: res.billing,
      };
    },
    onSuccess: ({ id, reply, speechText, actionId, billing: receipt }) => {
      setSessionId(id);
      setPendingTurn(null);
      qc.invalidateQueries({ queryKey: ["chat-messages", id] });
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      qc.invalidateQueries({ queryKey: ["ai-billing"] });
      if (receipt?.source === "flashcoins") {
        toast.success(
          T("Concluído com {coins} FlashCoins debitadas. Saldo disponível: {balance}.", {
            coins: receipt.chargedCoins,
            balance: receipt.balanceAfter.toLocaleString(),
          }),
        );
      }
      // Leitura automática da resposta (ligada por padrão; o botão silencia).
      if (getChatAutoPlay()) {
        void speak(speechText, { lang: effectiveLang, origin: "chat", actionId }).then((result) => {
          if (!result.ok && result.reason === "cloud-error") {
            toast.error(T("Não foi possível ler a resposta em voz alta"), {
              description: friendlyAiError(result.message).text,
            });
          }
        });
      }
    },
    onError: (e: Error, text) => {
      setPendingTurn(null);
      if (sessionId) qc.invalidateQueries({ queryKey: ["chat-messages", sessionId] });
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      // Fase 22 — nada do que o aluno escreveu é perdido: o texto volta ao campo
      // caso ele ainda não tenha começado a escrever outra mensagem.
      setDraft((d) => (d.trim() ? d : text));
      toastAiError(e, { persistent: true });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: (_r, id) => {
      if (sessionId === id) setSessionId(null);
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
    onError: (e: Error) => toastAiError(e),
  });

  const submit = (explicit?: string) => {
    const text = (explicit ?? draft).trim();
    if (!text || ask.isPending) return;
    // O navegador só permite falar sozinho depois se o áudio foi liberado
    // durante este toque; por isso destravamos aqui, antes de enviar.
    if (getChatAutoPlay()) primeSpeech();
    setDraft("");
    setPendingTurn(text);
    ask.mutate(text);
  };

  const openSession = (s: {
    id: string;
    lang: string;
    subject_id: string | null;
    level: string | null;
    topic: string | null;
    mode: string | null;
  }) => {
    stopSpeaking();
    setSessionId(s.id);
    setLang(s.lang === DEFAULT_LANGUAGE ? null : s.lang);
    setSubjectId(s.subject_id);
    setLevel((CHAT_LEVELS.find((l) => l.id === s.level)?.id ?? DEFAULT_LEVEL) as ChatLevelId);
    setTopic(s.topic ?? DEFAULT_TOPIC);
    setMode(findMode(s.mode).id);
    setPendingTurn(null);
  };

  /** Escolher a matéria herda o idioma dela (o seletor de idioma segue editável). */
  const chooseSubject = (value: string) => {
    setSessionId(null);
    setPendingTurn(null);
    if (value === NO_SUBJECT) {
      setSubjectId(null);
      return;
    }
    setSubjectId(value);
    const chosen = (subjects.data ?? []).find((s: { id: string }) => s.id === value) as
      { language: string | null } | undefined;
    if (chosen?.language) setLang(chosen.language === DEFAULT_LANGUAGE ? null : chosen.language);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{T("Conversação em idiomas")}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const next = !autoSpeak;
            setAutoSpeak(next);
            setChatAutoPlay(next);
            if (next) primeSpeech();
            else stopSpeaking();
          }}

          title={autoSpeak ? a.chat.voiceOnHint : a.chat.voiceOffHint}
        >
          {autoSpeak ? <Volume2 className="h-4 w-4 mr-1" /> : <VolumeX className="h-4 w-4 mr-1" />}
          {autoSpeak ? a.chat.voiceOn : a.chat.voiceOff}
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <label className="text-sm font-medium block mb-1">{T("Matéria (opcional)")}</label>
          <Select
            value={subjectId ?? NO_SUBJECT}
            onValueChange={chooseSubject}
            disabled={!!sessionId}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SUBJECT}>{a.chat.noSubject}</SelectItem>
              {(subjects.data ?? []).map(
                (s: { id: string; name: string; language: string | null }) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-1.5">
                      {s.name}
                      {s.language && languageFlag(s.language) ? (
                        <>
                          · <FlagIcon flag={languageFlag(s.language)!} /> {languageName(s.language)}
                        </>
                      ) : null}
                    </span>
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {T("A conversa herda o idioma da matéria escolhida.")}
          </p>
        </div>

        <LanguageSelect
          value={lang}
          onChange={(v) => {
            stopSpeaking();
            setLang(v);
            setSessionId(null);
            setPendingTurn(null);
          }}
          label={a.chat.convLanguage}
          noneLabel={a.chat.defaultLanguage}
          hint={a.chat.languageHint}
          disabled={!!sessionId}
        />

        <div>
          <label className="text-sm font-medium block mb-1">{T("Nível")}</label>
          <Select
            value={level}
            onValueChange={(v) => {
              setLevel(v as ChatLevelId);
              setSessionId(null);
              setPendingTurn(null);
            }}
            disabled={!!sessionId}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHAT_LEVELS.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {T(l.label)} ({l.cefr.join("–")})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">{T("Tema")}</label>
          <Select
            value={topic}
            onValueChange={(v) => {
              setTopic(v);
              setSessionId(null);
              setPendingTurn(null);
            }}
            disabled={!!sessionId}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SELECTABLE_CHAT_TOPICS.map((tp) => (
                <SelectItem key={tp.id} value={tp.id}>
                  {T(tp.label)}
                </SelectItem>
              ))}
              {topic === "card" && <SelectItem value="card">{a.chat.cardTopic}</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">{T("Modo")}</label>
          <Select
            value={mode}
            onValueChange={(v) => {
              setMode(v as ChatModeId);
              setSessionId(null);
              setPendingTurn(null);
            }}
            disabled={!!sessionId}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHAT_MODES.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {T(m.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">{T(findMode(mode).description)}</p>
        </div>
        {sessionId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              stopSpeaking();
              setSessionId(null);
              setPendingTurn(null);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> {T("Nova conversa")}
          </Button>
        )}
      </Card>

      {(sessions.data?.length ?? 0) > 0 && (
        <Card className="p-3 space-y-1">
          <p className="text-xs uppercase text-muted-foreground mb-1">{T("Suas conversas")}</p>
          <div className="max-h-80 overflow-y-auto space-y-1 pr-1">
            {sessions.data?.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => openSession(s)}
                  className={`flex-1 text-left text-sm truncate rounded px-2 py-1 ${
                    s.id === sessionId ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  {s.title}
                  <span className="text-muted-foreground">
                    {" "}
                    · {languageFlag(s.lang) ? <FlagIcon flag={languageFlag(s.lang)!} /> : null}{" "}
                    {languageName(s.lang)} · {T(modeLabel(s.mode))} · {T(findLevel(s.level).label)}{" "}
                    ({findLevel(s.level).cefr.join("–")}) · {T(topicLabel(s.topic))}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={a.chat.deleteChat}
                  onClick={() => remove.mutate(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {isRepeatMode ? (
        <RepeatAfterMe lang={effectiveLang} level={level} topic={topic} autoSpeak={autoSpeak} />
      ) : (
        <>
          <div className="space-y-3">
            {!sessionId && !pendingTurn && (
              <p className="text-sm text-muted-foreground">
                {T("Escreva uma primeira mensagem para começar a praticar.")}
              </p>
            )}
            {turns.map((turn, index) => {
              const correction =
                turn.role === "assistant" ? correctionOf(turn.correction_data) : null;
              return (
                <div
                  key={turn.id}
                  className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <Card
                    className={
                      turn.role === "user"
                        ? "p-3 max-w-[85%] bg-primary text-primary-foreground"
                        : "p-3 max-w-[85%]"
                    }
                  >
                    <p className="whitespace-pre-wrap text-sm select-none">{turn.content}</p>
                    {turn.role === "assistant" && (
                      <div className="mt-2 flex items-center gap-1">
                        <SpeakButton
                          text={turn.content}
                          lang={effectiveLang}
                          chatMessageId={turn.id}
                          ariaLabel={T("Narrar resposta")}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => {
                            // Frente = minha última mensagem antes desta resposta; verso = a resposta do PilotAI.
                            let question = "";
                            for (let i = index - 1; i >= 0; i -= 1) {
                              if (turns[i].role === "user") {
                                question = turns[i].content;
                                break;
                              }
                            }
                            setCardDraft({ question, answer: turn.content });
                          }}
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" /> {T("Criar flashcard")}
                        </Button>
                      </div>
                    )}
                    {correction && <CorrectionBox correction={correction} lang={effectiveLang} />}
                  </Card>
                </div>
              );
            })}
            {pendingTurn && (
              <div className="flex justify-end">
                <Card className="p-3 max-w-[85%] bg-primary text-primary-foreground opacity-70">
                  <p className="whitespace-pre-wrap text-sm select-none">{pendingTurn}</p>
                </Card>
              </div>
            )}
            {ask.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {T("Escrevendo…")}
              </div>
            )}
          </div>

          {billing.data?.prices.chat && (
            <p className="text-xs text-muted-foreground">
              {T("Depois da cota incluída: {coins} FlashCoins por turno.", {
                coins: billing.data.prices.chat,
              })}
            </p>
          )}
          <div className="flex gap-2 items-end">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={a.chat.messagePlaceholder}
              rows={2}
              maxLength={2000}
            />
            {/* Fase 16 — mesmo ditado usado no resto do app, sem segundo mecanismo. */}
            <MicButton
              value={draft}
              onChange={setDraft}
              lang={effectiveLang}
              onDictated={(text) => {
                setDraft("");
                submit(text);
              }}
            />
            <Button
              onClick={() => submit()}
              disabled={ask.isPending || !draft.trim()}
              aria-label={T("Enviar")}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      <CreateCardFromChatDialog
        open={!!cardDraft}
        onOpenChange={(o) => !o && setCardDraft(null)}
        phrase={cardDraft?.question ?? ""}
        initialAnswer={cardDraft?.answer ?? ""}
        lang={effectiveLang}
        subjectId={subjectId}
      />

      <Link to="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> {T("Voltar")}
      </Link>
    </div>
  );
}
