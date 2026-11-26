import { useAuditT } from "@/lib/i18n-audit";
import { T } from "@/lib/i18n-ui";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MindMapImage } from "@/components/MindMapImage";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";
import { getMindMapSignedUrl, deleteMindMapImage } from "@/lib/mindmap-image";
import { Download, Network, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/mindmaps")({
  component: MindMapsPage,
  head: () => ({
    meta: [
      { title: "Mapas mentais — FlashPilot" },
      { name: "description", content: "Seus mapas mentais gerados a partir de anotações e flashcards no FlashPilot." },
      { property: "og:title", content: "Mapas mentais — FlashPilot" },
      { property: "og:description", content: "Mapas mentais criados a partir das suas anotações e flashcards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  title: string;
  storage_path: string | null;
  category_id: string | null;
  note_id: string | null;
  created_at: string;
};

function MindMapsPage() {
  const qc = useQueryClient();
  const a = useAuditT();
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Row | null>(null);
  const [renaming, setRenaming] = useState<Row | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<Row | null>(null);

  const maps = useQuery({
    queryKey: ["mindmaps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_media")
        .select("id, title, storage_path, category_id, note_id, created_at")
        .eq("kind", "mindmap")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const cats = useQuery({
    queryKey: ["note_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("note_categories").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const catName = (id: string | null) =>
    (cats.data ?? []).find((c) => c.id === id)?.name ?? a.common.uncategorized;

  const rename = useMutation({
    mutationFn: async () => {
      if (!renaming) return;
      const { error } = await supabase
        .from("note_media")
        .update({ title: newTitle.trim() || renaming.title })
        .eq("id", renaming.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setRenaming(null);
      qc.invalidateQueries({ queryKey: ["mindmaps"] });
      qc.invalidateQueries({ queryKey: ["note_media"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : T("Falha ao renomear")),
  });

  const remove = useMutation({
    mutationFn: async (row: Row) => {
      if (row.storage_path) { try { await deleteMindMapImage(row.storage_path); } catch { /* best effort */ } }
      const { error } = await supabase.from("note_media").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleting(null);
      toast.success(T("Mapa mental excluído"));
      qc.invalidateQueries({ queryKey: ["mindmaps"] });
      qc.invalidateQueries({ queryKey: ["note_media"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : T("Falha ao excluir")),
  });

  async function download(row: Row) {
    if (!row.storage_path) return;
    try {
      const url = await getMindMapSignedUrl(row.storage_path);
      const resp = await fetch(url);
      const blob = await resp.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${row.title || "mapa-mental"}.png`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      toast.error(T("Não foi possível baixar a imagem"));
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = maps.data ?? [];
    if (!term) return rows;
    return rows.filter((r) =>
      r.title.toLowerCase().includes(term)
      || catName(r.category_id).toLowerCase().includes(term)
      || format(new Date(r.created_at), "dd/MM/yyyy").includes(term));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps.data, search, cats.data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl flex items-center gap-2">
          <Network className="h-5 w-5" /> {a.mm.title}
        </h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={a.mm.searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      {maps.isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{a.common.loading}</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <Network className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {a.mm.empty}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((row) => (
            <Card key={row.id} className="overflow-hidden select-none">
              <button
                type="button"
                className="block w-full bg-muted/30 p-2"
                onClick={() => setViewing(row)}
                title={`Abrir ${row.title}`}
              >
                <MindMapImage path={row.storage_path} className="max-h-40" />
              </button>
              <div className="p-3 space-y-1">
                <p className="font-medium truncate" title={row.title}>{row.title}</p>
                <p className="text-xs text-muted-foreground">
                  {catName(row.category_id)} · {format(new Date(row.created_at), "dd/MM/yyyy")}
                </p>
                <div className="flex gap-1 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => download(row)} title={a.common.download}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setRenaming(row); setNewTitle(row.title); }}
                    title={a.common.rename}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(row)} title={a.common.delete}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle></DialogHeader>
          {viewing && (
            <ImageZoomViewer key={viewing.id} path={viewing.storage_path} title={viewing.title} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(o) => { if (!o) setRenaming(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{a.mm.renameTitle}</DialogTitle></DialogHeader>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>{a.common.cancel}</Button>
            <Button onClick={() => rename.mutate()} disabled={rename.isPending}>{a.common.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{a.mm.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {a.mm.deleteDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{a.common.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && remove.mutate(deleting)}>{a.common.delete}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
