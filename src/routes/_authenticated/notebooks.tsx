import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  BookMarked, Play, Pencil, Trash2, RotateCcw, Loader2, Plus,
} from "lucide-react";
import {
  listNotebooks, getNotebook, createNotebook, updateNotebook, deleteNotebook,
  resetNotebookProgress, resetNotebookSchedule,
} from "@/lib/notebooks.functions";
import { flattenTopicTree, topicDisplayName } from "@/lib/topic-tree";
import { useAuditT } from "@/lib/i18n-audit";
import { useLang } from "@/lib/i18n";


export const Route = createFileRoute("/_authenticated/notebooks")({
  head: () => ({
    meta: [
      { title: "Flash Session — Flash Pilot" },
      { name: "description", content: "Monte Flash Session com as matérias e assuntos que você está estudando e retome a revisão em qualquer aparelho." },
      { property: "og:title", content: "Flash Session — Flash Pilot" },
      { property: "og:description", content: "Monte Flash Session com as matérias e assuntos que você está estudando e retome a revisão em qualquer aparelho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotebooksPage,
});

type Scope = { subjectId?: string | null; topicId?: string | null };

function NotebooksPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const a = useAuditT();
  const { lang } = useLang();

  const listFn = useServerFn(listNotebooks);
  const getFn = useServerFn(getNotebook);
  const createFn = useServerFn(createNotebook);
  const updateFn = useServerFn(updateNotebook);
  const deleteFn = useServerFn(deleteNotebook);
  const resetProgressFn = useServerFn(resetNotebookProgress);
  const resetScheduleFn = useServerFn(resetNotebookSchedule);

  const notebooks = useQuery({
    queryKey: ["notebooks"],
    queryFn: () => listFn({ data: undefined } as any),
  });

  const subjects = useQuery({
    queryKey: ["nb-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const topics = useQuery({
    queryKey: ["nb-topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, article_range, subject_id, parent_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; subject_id: string; parent_id: string | null }>;
    },
  });

  // ---- editor state ----
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState("all");
  const [orderMode, setOrderMode] = useState("alpha");
  const [pickedSubjects, setPickedSubjects] = useState<Set<string>>(new Set());
  const [pickedTopics, setPickedTopics] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Todos os níveis (assunto, subtópico, subitem…), indentados por matéria.
  const parentTopicsBySubject = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string; depth: number; path: string }>>();
    const rows = topics.data ?? [];
    const bySubject = new Map<string, typeof rows>();
    for (const tp of rows) {
      const arr = bySubject.get(tp.subject_id) ?? [];
      arr.push(tp);
      bySubject.set(tp.subject_id, arr);
    }
    for (const [subjectId, list] of bySubject) {
      map.set(subjectId, flattenTopicTree(list).map((o) => ({ id: o.id, name: topicDisplayName(o), depth: o.depth, path: o.path })));
    }
    return map;
  }, [topics.data]);


  function openCreate() {
    setEditingId(null);
    setName("");
    setMode("all");
    setOrderMode("alpha");
    setPickedSubjects(new Set());
    setPickedTopics(new Set());
    setEditorOpen(true);
  }

  async function openEdit(id: string) {
    try {
      const res = await getFn({ data: { id } });
      setEditingId(id);
      setName(res.notebook.name);
      setMode(res.notebook.mode);
      setOrderMode(res.notebook.order_mode);
      setPickedSubjects(new Set(res.scopes.filter((s: Scope) => s.subjectId).map((s: Scope) => s.subjectId as string)));
      setPickedTopics(new Set(res.scopes.filter((s: Scope) => s.topicId).map((s: Scope) => s.topicId as string)));
      setEditorOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : a.nb.openFail);
    }
  }

  async function save() {
    if (!name.trim()) { toast.error(a.nb.nameRequired); return; }
    setSaving(true);
    try {
      const scopes: Scope[] = [
        ...Array.from(pickedSubjects).map((subjectId) => ({ subjectId })),
        ...Array.from(pickedTopics).map((topicId) => ({ topicId })),
      ];
      if (editingId) {
        await updateFn({ data: { id: editingId, name, mode, orderMode, scopes } });
        toast.success(a.nb.updated);
      } else {
        await createFn({ data: { name, mode, orderMode, scopes, flashcardIds: [] } });
        toast.success(a.nb.created);
      }
      qc.invalidateQueries({ queryKey: ["notebooks"] });
      setEditorOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : a.nb.saveFail);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete(id: string) {
    setBusy(true);
    try {
      await deleteFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["notebooks"] });
      setConfirmDelete(null);
      toast.success(a.nb.deleted);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : a.nb.deleteFail);
    } finally {
      setBusy(false);
    }
  }

  async function doReset(id: string, kind: "progress" | "schedule") {
    setBusy(true);
    try {
      if (kind === "progress") {
        await resetProgressFn({ data: { id } });
        toast.success(a.nb.progressReset);
      } else {
        await resetScheduleFn({ data: { id } });
        toast.success(a.nb.scheduleReset);
      }
      qc.invalidateQueries();
      setResetTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : a.nb.resetFail);
    } finally {
      setBusy(false);
    }
  }

  function toggleSubject(id: string) {
    setPickedSubjects((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleTopic(id: string) {
    setPickedTopics((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif flex items-center gap-2">
            <BookMarked className="h-6 w-6" /> {a.nb.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {a.nb.subtitle}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> {a.nb.create}
        </Button>
      </div>

      {notebooks.isLoading ? (
        <p className="text-sm text-muted-foreground">{a.common.loading}</p>
      ) : (notebooks.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center bg-card/40">
          <p className="text-muted-foreground">{a.nb.empty}</p>
          <Button className="mt-4" onClick={openCreate}>{a.nb.createFirst}</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(notebooks.data ?? []).map((nb: any) => {
            const pct = nb.total_cards ? Math.round((nb.reviewed_count / nb.total_cards) * 100) : 0;
            return (
              <Card key={nb.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-medium truncate">{nb.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {a.nb.cardsOf(nb.reviewed_count, nb.total_cards)}
                      {nb.last_studied_at ? a.nb.lastStudied(new Date(nb.last_studied_at).toLocaleDateString(lang)) : ""}
                    </p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => navigate({ to: "/study", search: { notebook: nb.id } as any })}>
                    <Play className="h-4 w-4 mr-1" /> {a.nb.continue}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(nb.id)}>
                    <Pencil className="h-4 w-4 mr-1" /> {a.common.edit}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setResetTarget(nb.id)}>
                    <RotateCcw className="h-4 w-4 mr-1" /> {a.nb.reset}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(nb.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> {a.common.delete}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {a.nb.tipBefore}<Link to="/flashcards" className="underline">{a.nb.tipLink}</Link>{a.nb.tipAfter}
      </p>

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={(v) => { if (!saving) setEditorOpen(v); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? a.nb.editTitle : a.nb.newTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">{a.nb.name}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={a.nb.namePlaceholder} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium block mb-1">{a.nb.mode}</label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{a.nb.modeAll}</SelectItem>
                    <SelectItem value="due">{a.nb.modeDue}</SelectItem>
                    <SelectItem value="favorites">{a.nb.modeFav}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">{a.nb.order}</label>
                <Select value={orderMode} onValueChange={setOrderMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alpha">{a.nb.orderAlpha}</SelectItem>
                    <SelectItem value="shuffle">{a.nb.orderShuffle}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">{a.nb.content}</label>
              <div className="max-h-72 overflow-auto rounded-lg border border-border divide-y divide-border">
                {(subjects.data ?? []).map((s: any) => (
                  <div key={s.id} className="p-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={pickedSubjects.has(s.id)} onCheckedChange={() => toggleSubject(s.id)} />
                      <span className="text-sm font-medium">{s.name}</span>
                    </label>
                    {!pickedSubjects.has(s.id) && (parentTopicsBySubject.get(s.id) ?? []).length > 0 && (
                      <div className="pl-7 mt-1 space-y-1">
                        {(parentTopicsBySubject.get(s.id) ?? []).map((tp) => (
                          <label key={tp.id} className="flex items-center gap-2 cursor-pointer" title={tp.path}>
                            <Checkbox checked={pickedTopics.has(tp.id)} onCheckedChange={() => toggleTopic(tp.id)} />
                            <span className="text-sm text-muted-foreground" style={{ paddingLeft: tp.depth * 12 }}>
                              {tp.depth > 0 ? "↳ " : ""}{tp.name}
                            </span>
                          </label>
                        ))}

                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {a.nb.contentHint}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>{a.common.cancel}</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {a.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset */}
      <AlertDialog open={!!resetTarget} onOpenChange={(v) => { if (!busy && !v) setResetTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{a.nb.resetTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {a.nb.resetDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={busy}>{a.common.cancel}</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => resetTarget && doReset(resetTarget, "progress")}
            >
              {a.nb.resetOnlySession}
            </Button>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); if (resetTarget) doReset(resetTarget, "schedule"); }}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {a.nb.resetSchedule}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => { if (!busy && !v) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{a.nb.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {a.nb.deleteDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{a.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); if (confirmDelete) doDelete(confirmDelete); }}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {a.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
