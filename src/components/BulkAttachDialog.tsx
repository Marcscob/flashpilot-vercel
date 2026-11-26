import { useEffect, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NoteLinkPicker } from "@/components/NoteLinkPicker";
import { VideoLinksPicker } from "@/components/VideoLinksPicker";
import { uploadMindMapImage } from "@/lib/mindmap-image";
import { toast } from "sonner";
import { flattenCategoryTree, indentLabel } from "@/lib/note-category-tree";
import {
  Link2,
  Image as ImageIcon,
  Video,
  Upload,
  Loader2,
  FolderPlus,
  Trash2,
} from "lucide-react";

type Cat = { id: string; name: string; parent_id: string | null };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "note" | "image" | "video";
  ids: string[];
  onDone: () => void;
};

export function BulkAttachDialog({ open, onOpenChange, mode, ids, onDone }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  // ---- Note state ----
  const [noteId, setNoteId] = useState<string | null>(null);

  // ---- Image state ----
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  // ---- Video state ----
  const [video1, setVideo1] = useState<string | null>(null);
  const [video2, setVideo2] = useState<string | null>(null);

  const cats = useQuery({
    queryKey: ["note_categories"],
    enabled: open && mode === "image",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_categories")
        .select("id, name, parent_id, subject_id, topic_id")
        .order("name")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as Cat[];
    },
  });

  const sortedCats = flattenCategoryTree((cats.data ?? []) as any);

  useEffect(() => {
    if (!open) {
      setNoteId(null);
      setFile(null);
      setPreviewUrl(null);
      setCategoryId(null);
      setCreatingCat(false);
      setNewCatName("");
      setSaving(false);
      setVideo1(null);
      setVideo2(null);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error(T("Envie um arquivo de imagem"));
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error(T("Imagem muito grande (máx 8MB)"));
      return;
    }
    setFile(f);
  }

  async function createCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setSavingCat(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("note_categories")
        .insert({ user_id: u.user.id, name, parent_id: null })
        .select("id")
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["note_categories"] });
      qc.invalidateQueries({ queryKey: ["notes-picker"] });
      setCategoryId(data.id);
      setCreatingCat(false);
      setNewCatName("");
      toast.success(T("Categoria criada"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : T("Falha ao criar categoria"));
    } finally {
      setSavingCat(false);
    }
  }

  async function applyNote() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("flashcards")
        .update({ linked_note_id: noteId })
        .in("id", ids);
      if (error) throw error;
      toast.success(
        noteId
          ? T("Anotação vinculada a {n} flashcard(s)", { n: ids.length })
          : T("Anotação desvinculada de {n} flashcard(s)", { n: ids.length }),
      );
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha ao aplicar"));
    } finally {
      setSaving(false);
    }
  }

  async function applyImage(kind: "upload" | "remove") {
    setSaving(true);
    try {
      let patch: { image_url: string | null; image_category_id: string | null };
      if (kind === "remove") {
        patch = { image_url: null, image_category_id: null };
      } else {
        if (!file) throw new Error("Envie uma imagem");
        const path = await uploadMindMapImage(file, categoryId);
        patch = { image_url: path, image_category_id: categoryId };
      }
      const { error } = await supabase.from("flashcards").update(patch).in("id", ids);
      if (error) throw error;
      toast.success(
        kind === "remove"
          ? T("Imagem removida de {n} {cards}", {
              n: ids.length,
              cards: T(ids.length === 1 ? "flashcard" : "flashcards"),
            })
          : T("Imagem vinculada a {n} {cards}", {
              n: ids.length,
              cards: T(ids.length === 1 ? "flashcard" : "flashcards"),
            }),
      );
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha ao aplicar"));
    } finally {
      setSaving(false);
    }
  }

  async function applyVideo(action: "apply" | "remove" = "apply") {
    setSaving(true);
    try {
      const patch: { video_url_1: string | null; video_url_2: string | null } =
        action === "remove"
          ? { video_url_1: null, video_url_2: null }
          : { video_url_1: video1, video_url_2: video2 };
      const { error } = await supabase.from("flashcards").update(patch).in("id", ids);
      if (error) throw error;
      toast.success(
        action === "remove"
          ? T("Vídeos removidos de {n} flashcard(s)", { n: ids.length })
          : T("Vídeo(s) vinculado(s) a {n} flashcard(s)", { n: ids.length }),
      );
      qc.invalidateQueries({ queryKey: ["fc-list-all"] });
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha ao aplicar"));
    } finally {
      setSaving(false);
    }
  }

  const title =
    mode === "note"
      ? T("Vincular anotação a {n} flashcard(s)", { n: ids.length })
      : mode === "video"
        ? T("Vincular vídeo a {n} flashcard(s)", { n: ids.length })
        : `Vincular imagem a ${ids.length} flashcard${ids.length === 1 ? "" : "s"}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "note" ? (
              <Link2 className="h-4 w-4" />
            ) : mode === "video" ? (
              <Video className="h-4 w-4" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
            {T(
              mode === "note"
                ? T("Isto substituirá a anotação atual desses")
                : mode === "video"
                  ? T("Isto substituirá os links de vídeo atual desses")
                  : T("Isto substituirá a imagem atual desses"),
            )}{" "}
            <strong>{T("{n} flashcard(s).", { n: ids.length })}</strong>
          </div>

          {mode === "note" ? (
            <NoteLinkPicker value={noteId} onChange={setNoteId} />
          ) : mode === "video" ? (
            <VideoLinksPicker
              video1={video1}
              video2={video2}
              onChange={({ video1: v1, video2: v2 }) => {
                setVideo1(v1);
                setVideo2(v2);
              }}
            />
          ) : (
            <div className="space-y-3 rounded-xl border border-border p-3 bg-muted/30">
              {previewUrl && (
                <div className="rounded-lg overflow-hidden border border-border bg-background">
                  <img
                    src={previewUrl}
                    alt={T("Prévia")}
                    className="w-full max-h-48 object-contain select-none pointer-events-none"
                  />
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Select
                  value={categoryId ?? "__none__"}
                  onValueChange={(v) => setCategoryId(v === "__none__" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={T("Categoria (opcional)")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{T("Sem categoria")}</SelectItem>
                    {sortedCats.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>{T("Categorias")}</SelectLabel>
                        {sortedCats.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {indentLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreatingCat((v) => !v)}
                >
                  <FolderPlus className="h-4 w-4 mr-1" /> {T("Nova")}
                </Button>
              </div>

              {creatingCat && (
                <div className="flex items-center gap-2">
                  <Input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder={T("Nome da nova categoria")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createCategory();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={createCategory}
                    disabled={savingCat || !newCatName.trim()}
                  >
                    {savingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : T("Criar")}
                  </Button>
                </div>
              )}

              <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                  disabled={saving}
                />
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {file ? T("Trocar imagem") : T("Escolher imagem")}
                </span>
                {file && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {file.name}
                  </span>
                )}
              </label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {T("Cancelar")}
          </Button>
          {mode === "image" && (
            <Button variant="destructive" onClick={() => applyImage("remove")} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-1" /> {T("Remover imagem de todos")}
            </Button>
          )}
          {mode === "video" && (
            <Button variant="destructive" onClick={() => applyVideo("remove")} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-1" /> {T("Remover vídeos de todos")}
            </Button>
          )}
          {mode === "note" ? (
            <Button onClick={applyNote} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {T("Aplicar aos {n}", { n: ids.length })}
            </Button>
          ) : mode === "video" ? (
            <Button onClick={() => applyVideo("apply")} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {T("Aplicar aos {n}", { n: ids.length })}
            </Button>
          ) : (
            <Button onClick={() => applyImage("upload")} disabled={saving || !file}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {T("Aplicar aos {n}", { n: ids.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
