import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Gamepad2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MatchGame } from "@/components/MatchGame";
import { T } from "@/lib/i18n-ui";
import { pageHead } from "@/lib/page-head";
import { matchRoundSchema, type MatchRound } from "@/lib/match-game";

export const Route = createFileRoute("/_authenticated/games/$deckId")({
  head: () =>
    pageHead(
      "FlashMatch — FlashPilot",
      "Pratique o assunto associando conceitos e explicações no FlashMatch.",
    ),
  component: GamePage,
});

function GamePage() {
  const { deckId } = Route.useParams();

  const deck = useQuery({
    queryKey: ["game-deck", deckId],
    queryFn: async () => {
      const { data: head, error } = await supabase
        .from("game_decks")
        .select("id, title, topic_id, kind")
        .eq("id", deckId)
        .maybeSingle();
      if (error) throw error;
      if (!head) return null;
      const { data: rows, error: roundsError } = await supabase
        .from("game_rounds")
        .select("position, payload")
        .eq("deck_id", deckId)
        .order("position", { ascending: true });
      if (roundsError) throw roundsError;
      const rounds: MatchRound[] = [];
      for (const row of rows ?? []) {
        const parsed = matchRoundSchema.safeParse(row.payload);
        if (parsed.success) rounds.push(parsed.data);
      }
      return { ...head, rounds };
    },
  });

  const back = deck.data ? (
    <Link
      to="/topics/$topicId"
      params={{ topicId: deck.data.topic_id }}
      search={{ edit: undefined }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4" />
      {T("Voltar ao assunto")}
    </Link>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      {back}
      {deck.isLoading ? (
        <p className="text-sm text-muted-foreground">{T("Carregando…")}</p>
      ) : !deck.data || deck.data.rounds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
          <Gamepad2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-serif text-lg">{T("Este FlashMatch não foi encontrado.")}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-primary" />
            <h1 className="font-serif text-2xl">{deck.data.title}</h1>
          </div>
          <MatchGame rounds={deck.data.rounds} seedKey={deck.data.id} />
        </>
      )}
    </div>
  );
}
