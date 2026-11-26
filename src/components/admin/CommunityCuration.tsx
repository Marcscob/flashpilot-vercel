import DOMPurify from "dompurify";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Save, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { T } from "@/lib/i18n-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listCommunityCuration,
  listCurationMaterials,
  prepareCommunityCuration,
  reviewCommunityCuration,
} from "@/lib/community-curation.functions";
import { canIncorporateCuration, CurationReviewSchema } from "@/lib/community-curation";

type Row = Awaited<ReturnType<typeof listCommunityCuration>>[number];
const statuses = { pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado" };

export function CommunityCuration() {
  const list = useServerFn(listCommunityCuration);
  const prepare = useServerFn(prepareCommunityCuration);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("pending");
  const q = useQuery({ queryKey: ["community-curation"], queryFn: () => list({}), retry: false });
  async function audit() {
    setBusy(true);
    try {
      const result = await prepare({ data: { limit: 10 } });
      toast.success(
        result.prepared
          ? T("{n} candidatos preparados para revisão humana.", { n: result.prepared })
          : T("Nenhum novo card elegível (mínimo de 3 pessoas diferentes)."),
      );
      if (result.errors.length) toast.error(result.errors[0]);
      await qc.invalidateQueries({ queryKey: ["community-curation"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha na auditoria."));
    } finally {
      setBusy(false);
    }
  }
  const rows = (q.data ?? []).filter((row) => row.status === filter);
  return (
    <section className="mt-8 border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-xl text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" /> {T("Curadoria de matérias oficiais")}
        </h2>
        <Button onClick={audit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {T("Auditar com o PilotAI")}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {T("Revisão humana obrigatória · Originais preservados · Nenhuma publicação automática")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {T(
          "Reescrever livros ou doutrina não elimina direitos autorais. Confirme origem, autorização do autor e direitos comerciais antes de aprovar.",
        )}
      </p>
      <div className="my-4 flex flex-wrap gap-2" aria-label={T("Status da curadoria")}>
        {Object.entries(statuses).map(([status, label]) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            onClick={() => setFilter(status)}
          >
            {T(label)} ({(q.data ?? []).filter((r) => r.status === status).length})
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
  const review = useServerFn(reviewCommunityCuration);
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    question: row.question,
    answer: row.answer,
    subject: row.subject,
    chapter: row.chapter,
    topic: row.topic,
    language: row.language,
    reference: row.reference,
  });
  const [reviewNotes, setReviewNotes] = useState(row.review_notes);
  const [rightsNotes, setRightsNotes] = useState(row.rights_notes);
  const [rightsConfirmed, setRightsConfirmed] = useState(row.rights_confirmed);
  const [busy, setBusy] = useState(false);
  const [materials, setMaterials] = useState({
    note: false,
    map: false,
    links: false,
    videoIds: [] as string[],
  });
  const pending = row.status === "pending";
  async function decide(decision: "save" | "approve" | "reject") {
    const parsed = CurationReviewSchema.safeParse({
      ...draft,
      id: row.id,
      version: row.version,
      decision,
      reviewNotes,
      rightsNotes,
      rightsConfirmed,
      materials,
    });
    if (!parsed.success) {
      toast.error(T("Preencha a redação, taxonomia, parecer e comprovação de origem/direitos."));
      return;
    }
    setBusy(true);
    try {
      await review({ data: parsed.data });
      toast.success(
        decision === "approve"
          ? T("Card e materiais marcados incorporados ao tópico oficial.")
          : decision === "reject"
            ? T("Material rejeitado; original preservado.")
            : T("Revisão salva; material continua pendente."),
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["community-curation"] }),
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
          {T(row.eligible ? "Candidato elegível" : "Não elegível")} · {row.risk}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{row.audit_reason}</p>
      <details className="my-3 text-sm">
        <summary className="cursor-pointer text-primary">{T("Comparar com o original")}</summary>
        <div className="mt-2 space-y-2 whitespace-pre-wrap text-muted-foreground">
          <p>{row.source_question}</p>
          <p>{row.source_answer}</p>
        </div>
      </details>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["question", "Pergunta"],
            ["answer", "Resposta"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm text-foreground">
            {T(label)}
            <Textarea
              className="mt-1 min-h-32"
              value={draft[key]}
              disabled={!pending || busy}
              maxLength={key === "question" ? 4000 : 12000}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
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
      <label className="mt-3 block text-sm text-foreground">
        {T("Referência")}
        <Textarea
          className="mt-1"
          value={draft.reference}
          disabled={!pending || busy}
          maxLength={2000}
          onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))}
        />
      </label>
      {pending && (
        <MaterialsPicker id={row.id} value={materials} onChange={setMaterials} disabled={busy} />
      )}
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
            disabled={busy || !canIncorporateCuration(row.status, row.eligible, rightsConfirmed)}
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
          {T(row.status === "approved" ? "Aprovado e incorporado" : "Rejeitado")} ·{" "}
          {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString("pt-BR") : ""} ·{" "}
          {T("Versão {version}", { version: row.version })}
        </p>
      )}
    </article>
  );
}
type Pick = { note: boolean; map: boolean; links: boolean; videoIds: string[] };
function MaterialsPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: Pick;
  onChange: (p: Pick) => void;
  disabled: boolean;
}) {
  const load = useServerFn(listCurationMaterials);
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["curation-materials", id],
    queryFn: () => load({ data: { id } }),
    enabled: open,
    retry: false,
  });
  const m = q.data;
  const none = m && !m.note && !m.mapUrl && m.links.length === 0 && m.videos.length === 0;
  return (
    <details
      className="mt-3 rounded-md border border-border p-3 text-sm"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-primary">
        {T("Materiais do aluno (anotação, mapa, vídeos) — marque os que entram no card oficial")}
      </summary>
      {q.isLoading && <Loader2 className="mt-2 h-4 w-4 animate-spin text-primary" />}
      {q.isError && (
        <p className="mt-2 text-destructive">{T("Não foi possível carregar os materiais.")}</p>
      )}
      {none && (
        <p className="mt-2 text-muted-foreground">{T("Este card não tem materiais anexados.")}</p>
      )}
      {m && (
        <div className="mt-3 space-y-4">
          {m.note && (
            <div>
              <label className="flex items-center gap-2 font-medium text-foreground">
                <Checkbox
                  checked={value.note}
                  disabled={disabled}
                  onCheckedChange={(v) => onChange({ ...value, note: v === true })}
                />
                {T("Anotação: {title}", { title: m.note.title })}
              </label>
              <div
                className="prose prose-sm mt-2 max-h-60 overflow-auto rounded bg-muted p-2 text-foreground"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.note.html) }}
              />
            </div>
          )}
          {m.mapUrl && (
            <div>
              <label className="flex items-center gap-2 font-medium text-foreground">
                <Checkbox
                  checked={value.map}
                  disabled={disabled}
                  onCheckedChange={(v) => onChange({ ...value, map: v === true })}
                />
                {T("Mapa mental / imagem")}
              </label>
              <img
                src={m.mapUrl}
                alt={T("Mapa mental do aluno")}
                className="mt-2 max-h-72 rounded border border-border"
              />
            </div>
          )}
          {m.links.length > 0 && (
            <div>
              <label className="flex items-center gap-2 font-medium text-foreground">
                <Checkbox
                  checked={value.links}
                  disabled={disabled}
                  onCheckedChange={(v) => onChange({ ...value, links: v === true })}
                />
                {T("Links de vídeo")}
              </label>
              <ul className="mt-1 list-disc pl-6 text-muted-foreground">
                {m.links.map((l) => (
                  <li key={l}>
                    <a href={l} target="_blank" rel="noreferrer" className="underline">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {m.videos.map((v) => (
            <div key={v.id}>
              <label className="flex items-center gap-2 font-medium text-foreground">
                <Checkbox
                  checked={value.videoIds.includes(v.id)}
                  disabled={disabled}
                  onCheckedChange={(c) =>
                    onChange({
                      ...value,
                      videoIds:
                        c === true
                          ? [...value.videoIds, v.id]
                          : value.videoIds.filter((x) => x !== v.id),
                    })
                  }
                />
                {T("Vídeo FlashPilot-TV ({style} · {lang})", { style: v.style, lang: v.lang })}
              </label>
              <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-muted-foreground">
                {v.transcript}
              </p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            {T(
              "Nada é copiado sem marcação. Os itens marcados viram cópias oficiais, somente leitura; o original do aluno fica intacto.",
            )}
          </p>
        </div>
      )}
    </details>
  );
}
