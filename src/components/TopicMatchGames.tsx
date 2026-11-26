import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { createMatchGameFn } from "@/lib/match-game.functions";
import { friendlyAiError } from "@/lib/ai-error-toast";
import { T } from "@/lib/i18n-ui";

type DeckRow = {
  id: string;
  title: string;
  created_at: string;
  source_id: string | null;
  game_rounds: Array<{ count: number }>;
};
type SourceCard = { question: string; answer: string };

/** Um FlashMatch usa até 30 cards (um par por card). */
export const MATCH_CARDS_PER_GAME = 30;
const MIN_CARDS = 3;

/** Lista os FlashMatch do assunto e permite criar um novo a partir dos cards que o aluno já tem. */
export function TopicMatchGames(props: {
  topicId: string;
  cards: SourceCard[];
  language?: string | null;
}) {
  const qc = useQueryClient();
  const key = ["topic-match-games", props.topicId];
  const createFn = useServerFn(createMatchGameFn);
  const [range, setRange] = useState(0);

  const decks = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_decks")
        .select("id, title, created_at, source_id, game_rounds(count)")
        .eq("topic_id", props.topicId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DeckRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("game_decks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(T("FlashMatch excluído."));
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: () => toast.error(T("Não foi possível excluir o FlashMatch.")),
  });

  const groups = Math.max(1, Math.ceil(props.cards.length / MATCH_CARDS_PER_GAME));
  const selected = props.cards.slice(
    range * MATCH_CARDS_PER_GAME,
    (range + 1) * MATCH_CARDS_PER_GAME,
  );

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          actionId: crypto.randomUUID(),
          topicId: props.topicId,
          language: props.language ?? null,
          cards: selected.map((card) => ({ question: card.question, answer: card.answer })),
        },
      }),
    onSuccess: (game) => {
      toast.success(
        `${T("FlashMatch criado!")} (${game.roundCount} ${game.roundCount === 1 ? T("rodada") : T("rodadas")})`,
      );
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (error) => toast.error(friendlyAiError(error, { busy: "" }).text),
  });

  const canCreate = props.cards.length >= MIN_CARDS;
  if (!decks.data?.length && !canCreate) return null;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <h2 className="flex items-center gap-2 text-xl font-serif">
          <Gamepad2 className="h-5 w-5 text-primary" />
          FlashMatch
        </h2>
        {canCreate && (
          <div className="flex flex-wrap items-center gap-2">
            {groups > 1 && (
              <select
                value={range}
                onChange={(e) => setRange(Number(e.target.value))}
                disabled={create.isPending}
                aria-label={T("Escolha quais cards usar")}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {Array.from({ length: groups }, (_, i) => {
                  const from = i * MATCH_CARDS_PER_GAME + 1;
                  const to = Math.min(props.cards.length, (i + 1) * MATCH_CARDS_PER_GAME);
                  return (
                    <option key={i} value={i}>
                      {T("Cards")} {from}–{to}
                    </option>
                  );
                })}
              </select>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={create.isPending || selected.length < MIN_CARDS}
              onClick={() => create.mutate()}
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {create.isPending
                ? T("Criando o FlashMatch…")
                : T("Criar FlashMatch com os cards deste assunto")}
            </Button>
          </div>
        )}
      </div>
      {!!decks.data?.length && (
        <div className="grid gap-2 sm:grid-cols-2">
          {decks.data.map((deck) => {
            const rounds = deck.game_rounds?.[0]?.count ?? 0;
            return (
              <div
                key={deck.id}
                className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">{deck.title}</span>
                    {deck.source_id && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                        {T("Oficial")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {rounds} {rounds === 1 ? T("rodada") : T("rodadas")}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link to="/games/$deckId" params={{ deckId: deck.id }}>
                    <Play className="h-4 w-4" />
                    {T("Jogar")}
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={T("Excluir FlashMatch")}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(T("Excluir este FlashMatch?"))) remove.mutate(deck.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
