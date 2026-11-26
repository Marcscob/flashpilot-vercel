import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBulkT } from "@/lib/i18n-bulk";
import { Link2, Plus, FolderPlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
};

type Cat = { id: string; name: string; parent_id: string | null };
type Note = { id: string; title: string; category_id: string | null };

export function NoteLinkPicker({ value, onChange }: Props) {
  const b = useBulkT();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["notes-picker"],
    queryFn: async () => {
      const [cats, notes] = await Promise.all([
        supabase.from("note_categories").select("id, name, parent_id").order("name"),
        supabase.from("notes").select("id, title, category_id").order("title"),
      ]);
      if (cats.error) throw cats.error;
      if (notes.error) throw notes.error;
      return {
        cats: (cats.data ?? []) as Cat[],
        notes: (notes.data ?? []) as Note[],
      };
    },
  });

  const cats = q.data?.cats ?? [];
  const notes = q.data?.notes ?? [];

  const nameOf = (c: Cat): string => {
    const parts: string[] = [];
    let cur: Cat | undefined = c;
    let guard = 0;
    while (cur && guard++ < 8) {
      parts.unshift(cur.name);
      cur = cur.parent_id ? cats.find((x) => x.id === cur!.parent_id) : undefined;
    }
    return parts.join(" › ");
  };

  const grouped = new Map<string, Note[]>();
  const uncategorized: Note[] = [];
  notes.forEach((n) => {
    if (!n.category_id) { uncategorized.push(n); return; }
    const arr = grouped.get(n.category_id) ?? [];
    arr.push(n);
    grouped.set(n.category_id, arr);
  });

  const sortedCats = [...cats].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  // ---- Create new note inline ----
  const [creating, setCreating] = useState(false);
  const [nTitle, setNTitle] = useState("");
  const [nCatId, setNCatId] = useState<string>("__none__");
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [saving, setSaving] = useState(false);

  function resetCreate() {
    setCreating(false);
    setNTitle("");
    setNCatId("__none__");
    setNewCatMode(false);
    setNewCatName("");
  }

  async function createNote() {
    const title = nTitle.trim();
    if (!title) { toast.error(b.noteTitleRequired); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(b.notAuthenticated);

      let categoryId: string | null = nCatId === "__none__" ? null : nCatId;

      if (newCatMode) {
        const cname = newCatName.trim();
        if (!cname) throw new Error(b.categoryNameRequired);
        const { data: c, error: cErr } = await supabase
          .from("note_categories")
          .insert({ user_id: u.user.id, name: cname, parent_id: null })
          .select("id")
          .single();
        if (cErr) throw cErr;
        categoryId = c.id;
      }

      const { data: note, error } = await supabase
        .from("notes")
        .insert({
          user_id: u.user.id,
          title,
          content_html: "",
          category_id: categoryId,
        })
        .select("id")
        .single();
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["notes-picker"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["note_categories"] });
      onChange(note.id);
      toast.success(b.noteCreated);
      resetCreate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : b.noteCreateFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3 bg-muted/30">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> {b.noteLink}
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? (<><X className="h-3.5 w-3.5 mr-1" />{b.cancel}</>) : (<><Plus className="h-3.5 w-3.5 mr-1" />{b.newNote}</>)}
        </Button>
      </div>

      <Select
        value={value ?? "__none__"}
        onValueChange={(v) => onChange(v === "__none__" ? null : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder={b.pickNote} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{b.none}</SelectItem>
          {sortedCats.map((c) => {
            const list = grouped.get(c.id) ?? [];
            if (list.length === 0) return null;
            return (
              <SelectGroup key={c.id}>
                <SelectLabel>{nameOf(c)}</SelectLabel>
                {list.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.title || b.noteTitle}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
          {uncategorized.length > 0 && (
            <SelectGroup>
              <SelectLabel>{b.uncategorized}</SelectLabel>
              {uncategorized.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.title || b.noteTitle}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>

      {creating && (
        <div className="space-y-2 rounded-lg border border-border bg-background p-3">
          <Input
            value={nTitle}
            onChange={(e) => setNTitle(e.target.value)}
            placeholder={b.noteTitle}
          />
          {!newCatMode ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select value={nCatId} onValueChange={setNCatId}>
                <SelectTrigger>
                  <SelectValue placeholder={b.categoryOptional} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{b.noCategory}</SelectItem>
                  {sortedCats.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{b.categories}</SelectLabel>
                      {sortedCats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{nameOf(c)}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="sm" onClick={() => setNewCatMode(true)}>
                <FolderPlus className="h-4 w-4 mr-1" /> {b.new}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder={b.newCategoryName}
                autoFocus
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => { setNewCatMode(false); setNewCatName(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={createNote} disabled={saving || !nTitle.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              {b.createAndLink}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
