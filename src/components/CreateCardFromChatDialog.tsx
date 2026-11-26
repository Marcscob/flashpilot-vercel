import { T } from "@/lib/i18n-ui";
/**
 * Fase 17 — criar flashcard a partir de uma frase da conversa.
 *
 * O card gerado é sempre pessoal do aluno (user_id = quem está logado) e
 * herda o idioma da conversa, salvo alteração explícita no seletor. Nada de
 * conteúdo oficial é lido, alterado ou copiado aqui.
 */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LanguageSelect } from "@/components/LanguageSelect";
import { flattenTopicTree, topicDisplayName } from "@/lib/topic-tree";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
import { toast } from "sonner";
import { toastAiError } from "@/lib/ai-error-toast";
import { Loader2 } from "lucide-react";
import { saveFlashcardsAtomically } from "@/lib/flashcards-save.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Minha mensagem na conversa — vira a frente (pergunta) do card. */
  phrase: string;
  /** Resposta do PilotAI — vira o verso (resposta) do card. */
  initialAnswer?: string;
  /** Idioma da conversa (herdado). */
  lang: string;
  /** Matéria da conversa, quando houver. */
  subjectId?: string | null;
};

export function CreateCardFromChatDialog({
  open,
  onOpenChange,
  phrase,
  initialAnswer,
  lang,
  subjectId,
}: Props) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState(phrase);
  const [answer, setAnswer] = useState(initialAnswer ?? "");
  const [subject, setSubject] = useState<string | null>(subjectId ?? null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [cardLang, setCardLang] = useState<string | null>(lang === DEFAULT_LANGUAGE ? null : lang);
  const [ready, setReady] = useState(false);
  const saveFlashcards = useServerFn(saveFlashcardsAtomically);
  const saveActionRef = useRef<{ signature: string; actionId: string } | null>(null);

  // Reinicia os campos a cada abertura, sem perder o que o usuário digitou.
  if (open && !ready) {
    setQuestion(phrase);
    setAnswer(initialAnswer ?? "");
    setSubject(subjectId ?? null);
    setTopicId(null);
    setCardLang(lang === DEFAULT_LANGUAGE ? null : lang);
    setReady(true);
  }
  if (!open && ready) setReady(false);

  const subjects = useQuery({
    queryKey: ["chat-card-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: open,
  });

  const topics = useQuery({
    queryKey: ["chat-card-topics", subject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, parent_id, order_index, article_range")
        .eq("subject_id", subject as string);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: open && !!subject,
  });

  const options = useMemo(
    () =>
      flattenTopicTree(topics.data ?? []).map((o) => ({
        id: o.id,
        label: topicDisplayName(o),
        depth: o.depth,
      })),
    [topics.data],
  );

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(T("Sessão expirada. Entre novamente."));
      if (!topicId) throw new Error(T("Escolha o assunto onde o card será salvo."));
      const card = {
        topicId,
        question: question.trim(),
        answer: answer.trim() || question.trim(),
        language: cardLang,
      };
      const signature = JSON.stringify(card);
      if (saveActionRef.current?.signature !== signature) {
        saveActionRef.current = { signature, actionId: crypto.randomUUID() };
      }
      return saveFlashcards({
        data: {
          actionId: saveActionRef.current.actionId,
          cards: [card],
        },
      });
    },
    onSuccess: (saved) => {
      saveActionRef.current = null;
      toast.success(
        saved.chargedCoins > 0
          ? T("Concluído com {coins} FlashCoins debitadas. Saldo disponível: {balance}.", {
              coins: saved.chargedCoins,
              balance: saved.balance.toLocaleString(),
            })
          : T("Flashcard criado."),
      );
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      qc.invalidateQueries({ queryKey: ["cards", topicId] });
      qc.invalidateQueries({ queryKey: ["my-flashcards-count"] });
      qc.invalidateQueries({ queryKey: ["account-overview"] });
      qc.invalidateQueries({ queryKey: ["flashcoins"] });
      qc.invalidateQueries({ queryKey: ["ai-billing"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toastAiError(e),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{T("Criar flashcard desta frase")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">{T("Frente")}</label>
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              maxLength={2000}
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              {T("Verso (tradução ou observação)")}
            </label>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              maxLength={4000}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">{T("Matéria")}</label>
            <Select
              value={subject ?? ""}
              onValueChange={(v) => {
                setSubject(v);
                setTopicId(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={T("Escolha a matéria")} />
              </SelectTrigger>
              <SelectContent>
                {(subjects.data ?? []).map((s: { id: string; name: string }) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">{T("Assunto")}</label>
            <Select value={topicId ?? ""} onValueChange={setTopicId} disabled={!subject}>
              <SelectTrigger>
                <SelectValue
                  placeholder={subject ? T("Escolha o assunto") : T("Escolha a matéria primeiro")}
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {"\u00A0".repeat(o.depth * 2)}
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <LanguageSelect
            value={cardLang}
            onChange={setCardLang}
            label={T("Idioma do card")}
            noneLabel={T("Português (Brasil)")}
            hint={T("Herdado da conversa; pode ser alterado.")}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {T("Cancelar")}
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending || !question.trim() || !topicId}
          >
            {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {T("Criar flashcard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
