import { useEffect, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, Upload, X, Loader2, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import {
  uploadMindMapImage,
  getMindMapSignedUrl,
  deleteMindMapImage,
} from "@/lib/mindmap-image";
import { flattenCategoryTree, indentLabel } from "@/lib/note-category-tree";

type Cat = { id: string; name: string; parent_id: string | null };

type Props = {
  imagePath: string | null;
  categoryId: string | null;
  onChange: (patch: { imagePath: string | null; categoryId: string | null }) => void;
  hideUpload?: boolean;
};

export function MindMapPicker({ imagePath, categoryId, onChange, hideUpload }: Props) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  const cats = useQuery({
    queryKey: ["note_categories"],
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

  useEffect(() => {
    let alive = true;
    if (!imagePath) { setPreviewUrl(null); return; }
    getMindMapSignedUrl(imagePath).then((u) => { if (alive) setPreviewUrl(u); }).catch(() => {});
    return () => { alive = false; };
  }, [imagePath]);


  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error(T("Envie um arquivo de imagem")); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error(T("Imagem muito grande (máx 8MB)")); return; }
    setUploading(true);
    try {
      // delete previous file (best effort)
      if (imagePath) { try { await deleteMindMapImage(imagePath); } catch {} }
      const path = await uploadMindMapImage(file, categoryId);
      onChange({ imagePath: path, categoryId });
      toast.success(T("Imagem anexada"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : T("Falha ao enviar imagem"));
    } finally {
      setUploading(false);
    }
  }

  async function removeImage() {
    if (!imagePath) return;
    try { await deleteMindMapImage(imagePath); } catch {}
    onChange({ imagePath: null, categoryId });
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
      onChange({ imagePath, categoryId: data.id });
      setCreatingCat(false);
      setNewCatName("");
      toast.success(T("Categoria criada"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : T("Falha ao criar categoria"));
    } finally {
      setSavingCat(false);
    }
  }

  const sortedCats = flattenCategoryTree((cats.data ?? []) as any);

  return (
    <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/30">
      <label className="text-sm font-medium flex items-center gap-1.5">
        <ImageIcon className="h-3.5 w-3.5" /> {T("Mapa mental (imagem)")}
      </label>

      {previewUrl && (
        <div className="relative rounded-lg overflow-hidden border border-border bg-background">
          <img src={previewUrl} alt={T("Mapa mental")} className="w-full max-h-48 object-contain select-none pointer-events-none" />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-1 right-1 h-7 px-2"
            onClick={removeImage}
          >
            <X className="h-3 w-3 mr-1" /> {T("Remover")}
          </Button>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select
          value={categoryId ?? "__none__"}
          onValueChange={(v) => onChange({ imagePath, categoryId: v === "__none__" ? null : v })}
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
                  <SelectItem key={c.id} value={c.id}>{indentLabel(c)}</SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => setCreatingCat((v) => !v)}>
          <FolderPlus className="h-4 w-4 mr-1" /> {T("Nova")}
        </Button>
      </div>

      {creatingCat && (
        <div className="flex items-center gap-2">
          <Input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder={T("Nome da nova categoria")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCategory(); } }}
          />
          <Button type="button" size="sm" onClick={createCategory} disabled={savingCat || !newCatName.trim()}>
            {savingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : T("Criar")}
          </Button>
        </div>
      )}

      {!hideUpload && <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 hover:bg-muted">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {imagePath ? T("Trocar imagem") : T("Enviar imagem")}
        </span>
      </label>}
    </div>
  );
}
