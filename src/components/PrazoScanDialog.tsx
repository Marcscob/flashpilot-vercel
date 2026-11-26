import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Loader2, Timer } from "lucide-react";
import { toast } from "sonner";
import {
  scanPrazoCandidates,
  classifyPrazoBatch,
  copyPrazoCards,
} from "@/lib/prazos-scan.functions";

type Candidate = { id: string; q: string; a: string };
type Phase = "idle" | "scanning" | "classifying" | "review" | "copying" | "done";

const BATCH = 20;
const DEFAULT_SUBJECT = "processual civil";
const DEFAULT_TOPIC = "estudo dos prazos";

export function PrazoScanDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const scan = useServerFn(scanPrazoCandidates);
  const classify = useServerFn(classifyPrazoBatch);
  const copy = useServerFn(copyPrazoCards);

  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [analyzed, setAnalyzed] = useState(0);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [approved, setApproved] = useState<string[]>([]);
  const [scannedTotal, setScannedTotal] = useState(0);
  const [inserted, setInserted] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const subjects = useQuery({
    queryKey: ["prazo-scan-subjects"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const topics = useQuery({
    queryKey: ["prazo-scan-topics", subjectId],
    enabled: open && !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id,name,parent_id")
        .eq("subject_id", subjectId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (subjectId || !subjects.data?.length) return;
    const preferred =
      subjects.data.find((s) => s.name.toLowerCase().includes(DEFAULT_SUBJECT)) ?? subjects.data[0];
    setSubjectId(preferred.id);
  }, [open, subjects.data, subjectId]);

  useEffect(() => {
    if (!topics.data?.length) return;
    const preferred = topics.data.find((t) => t.name.toLowerCase().includes(DEFAULT_TOPIC));
    setTopicId((cur) =>
      cur && topics.data.some((t) => t.id === cur) ? cur : (preferred?.id ?? ""),
    );
  }, [topics.data]);

  const busy = phase === "scanning" || phase === "classifying" || phase === "copying";
  const pct = totalCandidates > 0 ? Math.round((analyzed / totalCandidates) * 100) : 0;

  const reset = () => {
    cancelRef.current = false;
    setPhase("idle");
    setAnalyzed(0);
    setTotalCandidates(0);
    setApproved([]);
    setInserted(0);
    setError(null);
  };

  const run = async () => {
    if (!subjectId || !topicId) return;
    reset();
    setPhase("scanning");
    let candidates: Candidate[] = [];
    try {
      const res = await scan({ data: { subjectId, targetTopicId: topicId } });
      candidates = res.candidates;
      setScannedTotal(res.total);
      setTotalCandidates(candidates.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : T("Falha ao varrer os cards."));
      setPhase("idle");
      return;
    }

    if (candidates.length === 0) {
      setPhase("review");
      return;
    }

    setPhase("classifying");
    const ok: string[] = [];
    for (let i = 0; i < candidates.length; i += BATCH) {
      if (cancelRef.current) break;
      const chunk = candidates.slice(i, i + BATCH);
      try {
        const res = await classify({
          data: { actionId: crypto.randomUUID(), items: chunk },
        });
        ok.push(...res.approved);
      } catch (e) {
        setError(e instanceof Error ? e.message : T("Falha na análise pelo PilotAI."));
        setApproved(ok);
        setPhase("review");
        return;
      }
      setAnalyzed(Math.min(i + chunk.length, candidates.length));
      setApproved([...ok]);
    }
    setApproved(ok);
    setPhase("review");
  };

  const doCopy = async () => {
    if (approved.length === 0) return;
    setPhase("copying");
    try {
      let total = 0;
      for (let i = 0; i < approved.length; i += 300) {
        const res = await copy({
          data: { ids: approved.slice(i, i + 300), targetTopicId: topicId },
        });
        total += res.inserted;
      }
      setInserted(total);
      setPhase("done");
      toast.success(T("{total} card(s) copiado(s) para o assunto de destino.", { total }));
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : T("Falha ao copiar os cards."));
      setPhase("review");
    }
  };

  const topicOptions = useMemo(() => topics.data ?? [], [topics.data]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-4 w-4" /> {T("Varredura de prazos")}
          </DialogTitle>
          <DialogDescription>
            {T(
              "Localiza cards que tratam de prazo ou lapso temporal e cria cópias independentes no assunto de destino.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{T("Matéria a varrer")}</label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={busy}>
              <SelectTrigger>
                <SelectValue placeholder={T("Selecione")} />
              </SelectTrigger>
              <SelectContent>
                {(subjects.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{T("Assunto de destino")}</label>
            <Select value={topicId} onValueChange={setTopicId} disabled={busy || !subjectId}>
              <SelectTrigger>
                <SelectValue placeholder={T("Selecione")} />
              </SelectTrigger>
              <SelectContent>
                {topicOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {phase === "scanning" && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {T("Varrendo os cards da matéria…")}
            </p>
          )}

          {(phase === "classifying" || (phase === "review" && totalCandidates > 0)) && (
            <div className="space-y-2">
              <Progress value={phase === "review" ? 100 : pct} />
              <p className="text-sm text-muted-foreground">
                {phase === "classifying"
                  ? `Analisando ${analyzed} de ${totalCandidates} candidatos…`
                  : `${totalCandidates} candidatos analisados de ${scannedTotal} cards.`}{" "}
                {T("Aprovados até agora:")} <strong>{approved.length}</strong>.
              </p>
            </div>
          )}

          {phase === "review" && totalCandidates === 0 && (
            <p className="text-sm text-muted-foreground">
              {T("Nenhum card novo com menção a prazo foi encontrado ({n} cards varridos).", {
                n: scannedTotal,
              })}
            </p>
          )}

          {phase === "copying" && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {T("Copiando cards…")}
            </p>
          )}

          {phase === "done" && (
            <p className="text-sm">
              {T("{n} card(s) copiado(s) para o assunto de destino. Duplicatas foram ignoradas.", {
                n: inserted,
              })}
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          {phase === "classifying" && (
            <Button
              variant="outline"
              onClick={() => {
                cancelRef.current = true;
              }}
            >
              {T("Cancelar análise")}
            </Button>
          )}
          {(phase === "idle" || phase === "done") && (
            <Button onClick={run} disabled={!subjectId || !topicId}>
              {phase === "done" ? T("Nova varredura") : T("Iniciar varredura")}
            </Button>
          )}
          {phase === "review" && (
            <>
              <Button variant="outline" onClick={run}>
                {T("Refazer")}
              </Button>
              <Button onClick={doCopy} disabled={approved.length === 0}>
                {T("Copiar {n} card(s)", { n: approved.length })}
              </Button>
            </>
          )}
          {busy && phase !== "classifying" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
