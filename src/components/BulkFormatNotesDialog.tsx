import { useMemo, useRef, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { formatNotePartWithAi } from "@/lib/notes-format.functions";
import { formatNoteInParts } from "@/lib/format-note-parts";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
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
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAiBillingInfo } from "@/hooks/useAiBillingInfo";
import { friendlyAiError, toastAiError } from "@/lib/ai-error-toast";

type NoteLite = { id: string; title: string; content_html: string; category_id: string | null };
type Cat = { id: string; name: string; parent_id: string | null };

type Result = { id: string; title: string; html?: string; error?: string };

const ALL = "__all__";
const UNCAT = "__uncat__";

export function BulkFormatNotesDialog({
  open,
  onOpenChange,
  notes,
  cats,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notes: NoteLite[];
  cats: Cat[];
  onDone: () => void;
}) {
  const format = useServerFn(formatNotePartWithAi);
  const qc = useQueryClient();
  const billing = useAiBillingInfo();
  const [cat, setCat] = useState<string>(ALL);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const cancelRef = useRef(false);

  const target = useMemo(() => {
    return notes
      .filter((n) => {
        if (cat === ALL) return true;
        if (cat === UNCAT) return !n.category_id;
        return n.category_id === cat;
      })
      .filter((n) => (n.content_html ?? "").trim().length > 0);
  }, [notes, cat]);

  async function run() {
    cancelRef.current = false;
    setRunning(true);
    setResults([]);
    setDone(0);
    const acc: Result[] = [];
    let chargedCoins = 0;
    let firstStoreError: unknown = null;
    const availableBalance: { value: number | null } = { value: null };
    for (const n of target) {
      if (cancelRef.current) break;
      try {
        const html = await formatNoteInParts(
          format,
          {
            actionId: crypto.randomUUID(),
            title: n.title ?? "",
            html: n.content_html,
          },
          undefined,
          undefined,
          (receipt) => {
            if (receipt.source === "flashcoins") {
              chargedCoins += receipt.chargedCoins;
              availableBalance.value = receipt.balanceAfter;
            }
          },
        );
        acc.push({ id: n.id, title: n.title, html });
      } catch (e) {
        const friendly = friendlyAiError(e);
        if (friendly.store && !firstStoreError) firstStoreError = e;
        const msg = e instanceof Error ? e.message : "";
        acc.push({
          id: n.id,
          title: n.title,
          error: friendly.store ? friendly.text : msg || T("Falha"),
        });
      }
      setResults([...acc]);
      setDone(acc.length);
    }
    setRunning(false);
    if (firstStoreError) toastAiError(firstStoreError, { persistent: true });
    if (chargedCoins > 0) {
      qc.invalidateQueries({ queryKey: ["ai-billing"] });
      toast.success(
        T("Concluído com {coins} FlashCoins debitadas. Saldo disponível: {balance}.", {
          coins: chargedCoins,
          balance: availableBalance.value?.toLocaleString() ?? "—",
        }),
      );
    }
  }

  async function applyAll() {
    const ok = results.filter((r) => r.html);
    if (!ok.length) return;
    setApplying(true);
    try {
      for (const r of ok) {
        const original = notes.find((n) => n.id === r.id)?.content_html ?? "";
        const { error } = await supabase
          .from("notes")
          .update({ content_html: r.html!, content_html_backup: original })
          .eq("id", r.id);
        if (error) throw error;
      }
      toast.success(T("{n} anotação(ões) formatada(s)", { n: ok.length }));
      onDone();
      onOpenChange(false);
      setResults([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha ao salvar"));
    } finally {
      setApplying(false);
    }
  }

  const okCount = results.filter((r) => r.html).length;
  const failCount = results.filter((r) => r.error).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!running) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> {T("Formatar anotações em lote")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
          {billing.data?.prices.note_format && (
            <p className="text-xs text-muted-foreground">
              {T("Depois da cota incluída: {coins} FlashCoins por ação.", {
                coins: billing.data.prices.note_format,
              })}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Select value={cat} onValueChange={setCat} disabled={running}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{T("Todas as categorias")}</SelectItem>
                <SelectItem value={UNCAT}>{T("Sem categoria")}</SelectItem>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {T("{n} nota(s)", { n: target.length })}
            </span>
          </div>

          {(running || results.length > 0) && (
            <div className="space-y-2">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${target.length ? (done / target.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {T("{done}/{total} processadas · {ok} ok · {fail} com erro", {
                  done,
                  total: target.length,
                  ok: okCount,
                  fail: failCount,
                })}
              </p>
              <ul className="text-xs space-y-1">
                {results.map((r) => (
                  <li key={r.id} className="flex items-start gap-1">
                    {r.html ? (
                      <Check className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                    ) : (
                      <X className="h-3 w-3 mt-0.5 text-destructive shrink-0" />
                    )}
                    <span className="truncate">{r.title || T("Sem título")}</span>
                    {r.error && <span className="text-destructive">— {r.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {T(
              "Nada é gravado até você confirmar. O texto original de cada nota fica guardado para desfazer.",
            )}
          </p>
        </div>

        <DialogFooter>
          {running ? (
            <Button
              variant="outline"
              onClick={() => {
                cancelRef.current = true;
              }}
            >
              {T("Cancelar")}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {T("Fechar")}
              </Button>
              <Button onClick={run} disabled={!target.length || applying}>
                <Sparkles className="h-4 w-4 mr-1" /> {T("Processar")}
              </Button>
              <Button onClick={applyAll} disabled={!okCount || applying}>
                {applying ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {T("Aplicar {n}", { n: okCount })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
