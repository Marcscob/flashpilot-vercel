import { useState } from "react";
import { T } from "@/lib/i18n-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { BookMarked, Loader2, Plus } from "lucide-react";
import { listNotebooks, addCardsToNotebook, createNotebook } from "@/lib/notebooks.functions";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  flashcardIds: string[];
  onDone?: () => void;
};

export function AddToNotebookDialog({ open, onOpenChange, flashcardIds, onDone }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(listNotebooks);
  const addFn = useServerFn(addCardsToNotebook);
  const createFn = useServerFn(createNotebook);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const notebooks = useQuery({
    queryKey: ["notebooks"],
    enabled: open,
    queryFn: () => list({ data: undefined } as any),
  });

  function toggle(id: string) {
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function apply() {
    if (flashcardIds.length === 0) return;
    setSaving(true);
    try {
      const targets = new Set(picked);
      const name = newName.trim();
      if (name) {
        const created = await createFn({
          data: { name, mode: "all", orderMode: "alpha", scopes: [], flashcardIds: [] },
        });
        targets.add(created.id);
      }
      if (targets.size === 0) {
        toast.error(T("Escolha uma Flash Session ou crie uma nova"));
        return;
      }
      for (const notebookId of targets) {
        await addFn({ data: { notebookId, flashcardIds } });
      }
      qc.invalidateQueries({ queryKey: ["notebooks"] });
      qc.invalidateQueries({ queryKey: ["card-notebooks"] });
      toast.success(
        T("{n} flashcard(s) adicionado(s) à Flash Session", { n: flashcardIds.length }),
      );
      setPicked(new Set());
      setNewName("");
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha ao adicionar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookMarked className="h-4 w-4" />
            {T("Adicionar {n} flashcard(s) a uma Flash Session", { n: flashcardIds.length })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {notebooks.isLoading ? (
            <p className="text-sm text-muted-foreground">{T("Carregando Flash Session…")}</p>
          ) : (notebooks.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {T("Você ainda não tem Flash Session. Crie uma abaixo.")}
            </p>
          ) : (
            <div className="max-h-60 overflow-auto rounded-lg border border-border divide-y divide-border">
              {(notebooks.data ?? []).map((nb: any) => (
                <label
                  key={nb.id}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox checked={picked.has(nb.id)} onCheckedChange={() => toggle(nb.id)} />
                  <span className="text-sm flex-1 min-w-0 truncate">{nb.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {nb.total_cards} {T(nb.total_cards === 1 ? "cartão" : "cartões")}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div>
            <label className="text-sm font-medium block mb-1">
              {T("Ou criar uma nova Flash Session")}
            </label>
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={T("Nome da nova Flash Session")}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {T("Cancelar")}
          </Button>
          <Button onClick={apply} disabled={saving || flashcardIds.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {T("Adicionar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
