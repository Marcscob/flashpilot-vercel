import { useEffect, useRef, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { formatNotePartWithAi } from "@/lib/notes-format.functions";
import { formatNoteInParts, FormatPartError } from "@/lib/format-note-parts";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { sanitizeNoteHtml } from "@/lib/sanitize-html";
import { useAiBillingInfo } from "@/hooks/useAiBillingInfo";
import type { AiBillingReceipt } from "@/lib/ai-quota.server";
import { friendlyAiError, toastAiError } from "@/lib/ai-error-toast";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  noteId: string | null;
  title: string;
  html: string;
  onApplied: (html: string) => void;
};

export function AiFormatNoteDialog({ open, onOpenChange, noteId, title, html, onApplied }: Props) {
  const format = useServerFn(formatNotePartWithAi);
  const qc = useQueryClient();
  const billing = useAiBillingInfo();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const [failed, setFailed] = useState<FormatPartError | null>(null);
  const actionRef = useRef<string>("");
  const runIdRef = useRef(0);

  function run(resume?: FormatPartError) {
    const runId = ++runIdRef.current;
    let finalReceipt: AiBillingReceipt | undefined;
    setLoading(true);
    setError(null);
    setFailed(null);
    formatNoteInParts(
      format,
      { actionId: actionRef.current, title, html },
      (p) => {
        if (runIdRef.current === runId) setProgress(p);
      },
      resume ? { startAt: resume.partIndex, previous: resume.previous } : undefined,
      (receipt) => {
        finalReceipt = receipt;
      },
    )
      .then((formatted) => {
        if (runIdRef.current !== runId) return;
        setResult(formatted);
        if (finalReceipt?.source === "flashcoins") {
          qc.invalidateQueries({ queryKey: ["ai-billing"] });
          toast.success(
            T("Concluído com {coins} FlashCoins debitadas. Saldo disponível: {balance}.", {
              coins: finalReceipt.chargedCoins,
              balance: finalReceipt.balanceAfter.toLocaleString(),
            }),
          );
        }
      })
      .catch((e) => {
        if (runIdRef.current !== runId) return;
        const friendly = friendlyAiError(e);
        setError(friendly.store ? friendly.text : (e?.message ?? T("Falha ao formatar.")));
        if (friendly.store) toastAiError(e, { persistent: true });
        // Part 0 failure releases the quota: next try needs a fresh action.
        if (e instanceof FormatPartError && e.partIndex > 0 && !e.message.includes("reconciliada"))
          setFailed(e);
        else actionRef.current = crypto.randomUUID();
      })
      .finally(() => {
        if (runIdRef.current === runId) setLoading(false);
      });
  }

  useEffect(() => {
    if (!open) {
      runIdRef.current++;
      setResult(null);
      setError(null);
      setFailed(null);
      setProgress({ done: 0, total: 0 });
      return;
    }
    if (!html.trim()) {
      setError(T("A anotação está vazia."));
      return;
    }
    actionRef.current = crypto.randomUUID();
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function apply() {
    if (!result || !noteId) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        .from("notes")
        .update({ content_html: result, content_html_backup: html })
        .eq("id", noteId);
      if (err) throw err;
      onApplied(result);
      toast.success(T("Anotação formatada"));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha ao salvar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> {T("Formatar com o PilotAI")}
          </DialogTitle>
        </DialogHeader>

        {billing.data?.prices.note_format && (
          <p className="text-xs text-muted-foreground">
            {T("Depois da cota incluída: {coins} FlashCoins por ação.", {
              coins: billing.data.prices.note_format,
            })}
          </p>
        )}

        <div className="flex-1 min-h-0 grid gap-3 md:grid-cols-2 overflow-hidden">
          <div className="min-h-0 flex flex-col">
            <p className="text-xs text-muted-foreground mb-1">{T("Original")}</p>
            <div
              className="note-body flex-1 overflow-y-auto rounded-lg border border-border p-3 bg-muted/30"
              dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(html) }}
            />
          </div>
          <div className="min-h-0 flex flex-col">
            <p className="text-xs text-muted-foreground mb-1">{T("Padronizado")}</p>
            <div className="flex-1 overflow-y-auto rounded-lg border border-border p-3 bg-card">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress.total > 1
                    ? `Formatando parte ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…`
                    : "Formatando…"}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {error && !loading && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => run(failed ?? undefined)}
                >
                  {failed
                    ? `Tentar novamente a partir da parte ${failed.partIndex + 1}`
                    : T("Tentar novamente")}
                </Button>
              )}
              {result && (
                <div
                  className="note-body"
                  dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(result) }}
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {T("Descartar")}
          </Button>
          <Button onClick={apply} disabled={!result || saving || loading}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            {T("Aplicar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
