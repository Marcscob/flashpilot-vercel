import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Gamepad2, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { T } from "@/lib/i18n-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listGameCuration,
  prepareGameCuration,
  reviewGameCuration,
} from "@/lib/game-curation.functions";
import { GameCurationReviewSchema, canIncorporateGame } from "@/lib/game-curation";
import { matchRoundSchema, type MatchRound } from "@/lib/match-game";
import { z } from "zod";

type Row = Awaited<ReturnType<typeof listGameCuration>>[number];
const statuses = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" } as const;

export function GameCuration() {
  const list = useServerFn(listGameCuration);
  const prepare = useServerFn(prepareGameCuration);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<keyof typeof statuses>("pending");
  const q = useQuery({ queryKey: ["game-curation"], queryFn: () => list({}), retry: false });

  async function audit() {
    setBusy(true);
    try {
      const result = await prepare({ data: { limit: 10 } });
      toast.success(
        result.prepared
          ? T("{n} FlashMatch auditados para revisão humana.", { n: result.prepared })
          : T("Nenhum FlashMatch novo para auditar."),
      );
      if (result.errors.length) toast.error(result.errors[0]!);
      await qc.invalidateQueries({ queryKey: ["game-curation"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha na auditoria."));
    } finally {
      setBusy(false);
    }
  }

  const rows = (q.data ?? []).filter((row) => row.status === filter);
  const unaudited = (q.data ?? []).filter((row) => row.status === "pending" && !row.audited).length;
  return (
    <section className="mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-xl text-foreground">
          <Gamepad2 className="h-5 w-5 text-primary" /> {T("Curadoria de FlashMatch")}
        </h2>
        <Button onClick={audit} disabled={busy || unaudited === 0}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {T("Auditar com o PilotAI")}
          {unaudited > 0 ? ` (${unaudited})` : ""}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {T(
          "Todo FlashMatch criado por alunos chega aqui como pendente. Nada é publicado sem a sua aprovação.",
        )}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {T(
          "Aprove só com origem e direitos comerciais confirmados. Ao aprovar, o game vira oficial e é entregue a quem tem a matéria.",
        )}
      </p>
      <div className="my-4 flex flex-wrap gap-2" aria-label={T("Status da curadoria")}>
        {(Object.keys(statuses) as Array<keyof typeof statuses>).map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            onClick={() => setFilter(status)}
          >
            {T(statuses[status])} ({(q.data ?? []).filter((r) => r.status === status).length})
          </Button>
        ))}
      </div>
      {q.isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
      {q.isError && (
        <p className="text-sm text-destructive">{T("Não foi possível carregar a curadoria.")}</p>
      )}
      {!q.isLoading && !q.isError && rows.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">{T("Nenhum material nesta etapa.")}</p>
      )}
      <div className="space-y-4">
        {rows.map((row) => (
          <ReviewItem key={`${row.id}-${row.version}`} row={row} />
        ))}
      </div>
    </section>
  );
}

function ReviewItem({ row }: { row: Row }) {
  const review = useServerFn(reviewGameCuration);
  const qc = useQueryClient();
  const parsedRounds = z.array(matchRoundSchema).safeParse(row.rounds);
  const [rounds, setRounds] = useState<MatchRound[]>(parsedRounds.success ? parsedRounds.data : []);
  const [draft, setDraft] = useState({
    title: row.title,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    language: row.language,
  });
  const [reviewNotes, setReviewNotes] = useState(row.review_notes);
  const [rightsNotes, setRightsNotes] = useState(row.rights_notes);
  const [rightsConfirmed, setRightsConfirmed] = useState(row.rights_confirmed);
  const [busy, setBusy] = useState(false);
  const pending = row.status === "pending";

  function setPair(roundIndex: number, pairIndex: number, side: "left" | "right", value: string) {
    setRounds((all) =>
      all.map((round, i) =>
        i !== roundIndex
          ? round
          : {
              pairs: round.pairs.map((pair, j) =>
                j === pairIndex ? { ...pair, [side]: value } : pair,
              ),
            },
      ),
    );
  }

  async function decide(decision: "save" | "approve" | "reject") {
    const parsed = GameCurationReviewSchema.safeParse({
      ...draft,
      rounds,
      id: row.id,
      version: row.version,
      decision,
      reviewNotes,
      rightsNotes,
      rightsConfirmed,
    });
    if (!parsed.success) {
      toast.error(
        T("Preencha título, taxonomia, pares, parecer e comprovação de origem/direitos."),
      );
      return;
    }
    setBusy(true);
    try {
      await review({ data: parsed.data });
      toast.success(
        decision === "approve"
          ? T("FlashMatch aprovado e incorporado ao conteúdo oficial.")
          : decision === "reject"
            ? T("FlashMatch rejeitado.")
            : T("Revisão salva; o FlashMatch continua pendente."),
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["game-curation"] }),
        qc.invalidateQueries({ queryKey: ["admin-subject-packs"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Não foi possível salvar."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-medium text-foreground">
          {row.subject} / {row.chapter} / {row.topic}
        </h3>
        <span className={row.eligible ? "text-xs text-success" : "text-xs text-destructive"}>
          {!row.audited
            ? T("Aguardando auditoria")
            : row.eligible
              ? T("Candidato elegível")
              : T("Não elegível")}{" "}
          · {row.risk}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{row.audit_reason}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["title", "Título"],
            ["subject", "Matéria"],
            ["chapter", "Assunto"],
            ["topic", "Tópico"],
            ["language", "Idioma"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm text-foreground">
            {T(label)}
            <Input
              className="mt-1"
              value={draft[key]}
              disabled={!pending || busy}
              maxLength={key === "language" ? 20 : 160}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="rounded-md border border-border/70 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              {T("Rodada")} {roundIndex + 1}
            </p>
            <div className="space-y-2">
              {round.pairs.map((pair, pairIndex) => (
                <div key={pairIndex} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={pair.left}
                    disabled={!pending || busy}
                    maxLength={200}
                    aria-label={T("Conceito")}
                    onChange={(e) => setPair(roundIndex, pairIndex, "left", e.target.value)}
                  />
                  <Input
                    value={pair.right}
                    disabled={!pending || busy}
                    maxLength={400}
                    aria-label={T("Explicação")}
                    onChange={(e) => setPair(roundIndex, pairIndex, "right", e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {!parsedRounds.success && (
          <p className="text-sm text-destructive">
            {T("As rodadas deste candidato estão inválidas.")}
          </p>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-foreground">
          {T("Parecer humano")}
          <Textarea
            className="mt-1"
            value={reviewNotes}
            disabled={!pending || busy}
            maxLength={4000}
            onChange={(e) => setReviewNotes(e.target.value)}
          />
        </label>
        <label className="text-sm text-foreground">
          {T("Origem e comprovação de direitos")}
          <Textarea
            className="mt-1"
            value={rightsNotes}
            disabled={!pending || busy}
            maxLength={4000}
            onChange={(e) => setRightsNotes(e.target.value)}
          />
        </label>
      </div>
      <label className="my-4 flex items-start gap-2 text-sm text-foreground">
        <Checkbox
          checked={rightsConfirmed}
          disabled={!pending || busy}
          onCheckedChange={(value) => setRightsConfirmed(value === true)}
        />
        {T(
          "Confirmei a precisão, a ausência de dados pessoais e os direitos/autorização necessários para uso comercial.",
        )}
      </label>
      {pending ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => decide("save")}>
            <Save className="h-4 w-4" /> {T("Salvar revisão")}
          </Button>
          <Button
            disabled={busy || !canIncorporateGame(row.status, row.eligible, rightsConfirmed)}
            onClick={() => decide("approve")}
          >
            <Check className="h-4 w-4" /> {T("Aprovar e incorporar")}
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => decide("reject")}>
            <X className="h-4 w-4" /> {T("Rejeitar")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {row.status === "approved" ? T("Aprovado e incorporado") : T("Rejeitado")}
          {row.reviewed_at ? ` · ${new Date(row.reviewed_at).toLocaleString()}` : ""}
        </p>
      )}
    </article>
  );
}
