import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Network, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { toastAiError } from "@/lib/ai-error-toast";
import { generateMindMap } from "@/lib/mindmap-generate.functions";
import { suggestCardMaterialTitle } from "@/lib/card-note.functions";
import { renderMindMapPng, type MindMapTree } from "@/lib/mindmap-render";
import { uploadMindMapImage } from "@/lib/mindmap-image";
import { flattenCategoryTree, indentLabel } from "@/lib/note-category-tree";
import { useAiBillingInfo } from "@/hooks/useAiBillingInfo";
import { MindMapTreeEditor } from "@/components/MindMapTreeEditor";

type Source =
  | { kind: "note"; noteId: string; title: string; categoryId: string | null }
  | { kind: "cards"; cardIds: string[]; title?: string; suggestLang?: string }
  | { kind: "text"; text: string; lang?: string; title?: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Source | null;
  onSaved?: (saved: { path: string; categoryId: string | null }) => void;
  /** Quando definido, o mapa é salvo nesta categoria e o seletor fica oculto. */
  fixedCategoryId?: string | null;
};

const DETAILS = [
  { value: "short", label: "Resumido" },
  { value: "normal", label: T("Padrão") },
  { value: "deep", label: "Detalhado" },
] as const;

export function GenerateMindMapDialog({
  open,
  onOpenChange,
  source,
  onSaved,
  fixedCategoryId,
}: Props) {
  const qc = useQueryClient();
  const generate = useServerFn(generateMindMap);
  const billing = useAiBillingInfo();

  const [detail, setDetail] = useState<"short" | "normal" | "deep">("normal");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tree, setTree] = useState<MindMapTree | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const cats = useQuery({
    queryKey: ["note_categories"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_categories")
        .select("id, name, parent_id")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const sortedCats = useMemo(() => flattenCategoryTree(cats.data ?? []), [cats.data]);

  useEffect(() => {
    if (!open) return;
    setTree(null);
    setBlob(null);
    setPreviewUrl(null);
    setDetail("normal");
    setTitle(source && source.kind === "note" ? source.title : (source?.title ?? ""));
    setCategoryId(
      fixedCategoryId !== undefined
        ? fixedCategoryId
        : source && source.kind === "note"
          ? source.categoryId
          : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedCategoryId]);

  const suggestKey =
    source && source.kind === "cards" && source.suggestLang
      ? `${source.cardIds.join(",")}|${source.suggestLang}`
      : "";
  const suggest = useServerFn(suggestCardMaterialTitle);
  const [suggesting, setSuggesting] = useState(false);
  useEffect(() => {
    if (
      !open ||
      !source ||
      source.kind !== "cards" ||
      !source.suggestLang ||
      source.cardIds.length !== 1
    )
      return;
    let alive = true;
    setSuggesting(true);
    suggest({ data: { cardId: source.cardIds[0], lang: source.suggestLang, kind: "mindmap" } })
      .then((r) => {
        if (alive && r.title) setTitle((cur) => (cur.trim() ? cur : r.title));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setSuggesting(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, suggestKey]);

  useEffect(() => {
    if (!blob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useEffect(() => {
    if (!tree) return;
    let alive = true;
    void renderMindMapPng({ ...tree, title: title.trim() || tree.title })
      .then((png) => {
        if (alive) setBlob(png);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tree, title]);

  const run = useMutation({
    mutationFn: async () => {
      if (!source) throw new Error("Nada selecionado.");
      const response = await generate({
        data: {
          ...(source.kind === "note"
            ? { source: "note" as const, noteId: source.noteId }
            : source.kind === "text"
              ? { source: "text" as const, text: source.text, lang: source.lang }
              : { source: "cards" as const, cardIds: source.cardIds }),
          actionId: crypto.randomUUID(),
          detail,
          title: title.trim(),
        },
      });
      const result = response.tree;
      const png = await renderMindMapPng(result);
      return { result, png, billing: response.billing };
    },
    onSuccess: ({ result, png, billing: receipt }) => {
      setTree(result);
      setBlob(png);
      if (!title.trim()) setTitle(result.title);
      qc.invalidateQueries({ queryKey: ["ai-billing"] });
      if (receipt?.source === "flashcoins") {
        toast.success(
          T("Concluído com {coins} FlashCoins debitadas. Saldo disponível: {balance}.", {
            coins: receipt.chargedCoins,
            balance: receipt.balanceAfter.toLocaleString(),
          }),
        );
      }
    },
    onError: (e) => toastAiError(e),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!blob || !tree) throw new Error("Gere o mapa antes de salvar.");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(T("Sessão expirada. Entre novamente."));
      const name = (title.trim() || tree.title || T("Mapa mental")).slice(0, 160);
      const editedTree = { ...tree, title: name };
      const editedBlob = await renderMindMapPng(editedTree);
      const file = new File([editedBlob], `${Date.now()}.png`, { type: "image/png" });
      const path = await uploadMindMapImage(file, categoryId);
      const { error } = await supabase.from("note_media").insert({
        user_id: u.user.id,
        kind: "mindmap",
        title: name,
        storage_path: path,
        url: JSON.stringify(editedTree),
        category_id: categoryId,
        note_id: source && source.kind === "note" ? source.noteId : null,
      });
      if (error) throw error;
      return { path, categoryId };
    },
    onSuccess: (saved) => {
      toast.success(T("Mapa mental salvo"));
      qc.invalidateQueries({ queryKey: ["note_media"] });
      qc.invalidateQueries({ queryKey: ["mindmaps"] });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : T("Falha ao salvar o mapa mental")),
  });

  const count = source?.kind === "cards" ? source.cardIds.length : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!run.isPending && !save.isPending) onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-4 w-4" /> {T("Gerar mapa mental")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {source?.kind === "cards" && (
            <p className="text-sm text-muted-foreground">
              {T("{count} flashcard(s) selecionado(s) como fonte.", { count })}
            </p>
          )}

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={suggesting ? T("PilotAI sugerindo título...") : T("Título do mapa mental")}
          />

          <div
            className={fixedCategoryId !== undefined ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}
          >
            <Select value={detail} onValueChange={(v) => setDetail(v as typeof detail)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DETAILS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fixedCategoryId === undefined && (
              <Select
                value={categoryId ?? "__none__"}
                onValueChange={(v) => setCategoryId(v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={T("Categoria (opcional)")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{T("Sem categoria")}</SelectItem>
                  {sortedCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {indentLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {T(
              "A geração usa seus créditos do PilotAI. O mapa sai no idioma do conteúdo escolhido.",
            )}
            {billing.data?.prices.mindmap
              ? ` ${T("Depois da cota incluída: {coins} FlashCoins por ação.", { coins: billing.data.prices.mindmap })}`
              : ""}
          </p>

          {run.isPending && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> {T("Montando o mapa mental…")}
            </div>
          )}

          {tree && (
            <div className="max-h-[30vh] overflow-auto">
              <MindMapTreeEditor
                nodes={tree.nodes}
                onChange={(nodes) => setTree({ ...tree, nodes })}
              />
            </div>
          )}
          {previewUrl && (
            <div className="max-h-[45vh] overflow-auto rounded-xl border border-border bg-background p-2">
              <img
                src={previewUrl}
                alt={T("Mapa mental gerado")}
                className="w-full h-auto select-none"
                draggable={false}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={run.isPending || save.isPending}
          >
            {blob ? "Descartar" : T("Cancelar")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => run.mutate()}
            disabled={run.isPending || save.isPending}
          >
            <Sparkles className="h-4 w-4 mr-1" /> {blob ? T("Gerar de novo") : T("Gerar")}
          </Button>
          <Button onClick={() => save.mutate()} disabled={!blob || save.isPending || run.isPending}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {T("Salvar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
