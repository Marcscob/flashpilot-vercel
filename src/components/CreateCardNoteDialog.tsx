import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { generateCardNote } from "@/lib/card-note.functions";
import { toastAiError } from "@/lib/ai-error-toast";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { T } from "@/lib/i18n-ui";

/** Categoria espelho do tópico do card (mesma regra do Bulk v2). */
export async function cardMirrorCategory(cardId: string): Promise<string | null> {
  const { data: c } = await supabase.from("flashcards").select("topic_id").eq("id", cardId).maybeSingle();
  if (!c?.topic_id) return null;
  const { data } = await supabase.from("note_categories").select("id").eq("topic_id", c.topic_id).limit(1).maybeSingle();
  return data?.id ?? null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (t: string) => t.split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");

export function CreateCardNoteDialog({ open, onOpenChange, cardId, lang, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; cardId: string; lang: string;
  onSaved: (note: { id: string; title: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);

  const draft = async () => {
    setDrafting(true);
    try {
      const r = await generateCardNote({ data: { actionId: crypto.randomUUID(), cardId, lang } });
      setTitle(r.title); setBody(r.text); setDrafted(true);
    } catch (e) {
      toastAiError(e);
    } finally {
      setDrafting(false);
    }
  };
  // Draft only when the user opened this dialog, once per opening.
  useEffect(() => { if (open && !drafted && !drafting) void draft(); if (!open) setDrafted(false); }, [open]);

  const save = async () => {
    if (!title.trim() || !body.trim()) return toast.error(T("Preencha o título e o texto da anotação."));
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(T("Sessão expirada. Entre novamente."));
      const category_id = await cardMirrorCategory(cardId);
      const { data, error } = await supabase.from("notes")
        .insert({ user_id: u.user.id, title: title.trim().slice(0, 200), content_html: toHtml(body), category_id })
        .select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("flashcards").update({ linked_note_id: data.id }).eq("id", cardId);
      if (e2) throw e2;
      onSaved({ id: data.id, title: title.trim() });
      toast.success(T("Anotação salva"));
      setBody(""); setTitle("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : T("Falha ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>{T("Criar anotação")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {drafting && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{T("O PilotAI está escrevendo a anotação a partir do card…")}</p>}
          <Input disabled={drafting} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={T("Título")} />
          <Textarea disabled={drafting} value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder={T("Escreva sua anotação...")} />
          <div className="flex gap-2">
            <Button variant="outline" disabled={drafting || saving} onClick={draft}><Sparkles className="mr-1 h-4 w-4" />{T("Gerar novamente")}</Button>
            <Button className="flex-1" disabled={saving || drafting} onClick={save}>{T("Salvar")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
