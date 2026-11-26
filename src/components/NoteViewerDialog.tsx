import { useStudyT } from "@/lib/i18n-audit";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SpeakButton } from "@/components/SpeakButton";
import { NoteExportMenu } from "@/components/NoteExportMenu";
import { AiFormatNoteDialog } from "@/components/AiFormatNoteDialog";
import { useScreenT } from "@/lib/i18n-screens";
import { htmlToPlainText, ttsSupported } from "@/lib/tts";
import { normalizeNoteHtml } from "@/lib/note-format";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";
import { Loader2, Save, Maximize2, Minimize2, Sparkles } from "lucide-react";

type Props = {
  noteId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

export function NoteViewerDialog({ noteId, open, onOpenChange }: Props) {
  const s0 = useStudyT();
  const t = useT();
  const sc = useScreenT();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [maxed, setMaxed] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const note = useQuery({
    queryKey: ["note-viewer", noteId],
    enabled: !!noteId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, content_html")
        .eq("id", noteId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (note.data) {
      setTitle(note.data.title ?? "");
      setContent(note.data.content_html ?? "");
    }
  }, [note.data]);

  async function save() {
    if (!noteId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notes")
        .update({
          title: title.trim() || t.notes.untitled,
          content_html: normalizeNoteHtml(content),
        })
        .eq("id", noteId);
      if (error) throw error;
      toast.success(t.common.save);
      qc.invalidateQueries({ queryKey: ["notes"] });
      qc.invalidateQueries({ queryKey: ["note-viewer", noteId] });
    } catch (e: any) {
      toast.error(e?.message ?? t.common.error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          maxed
            ? "flex flex-col w-[98vw] max-w-[98vw] h-[96vh] max-h-[96vh]"
            : "flex flex-col max-w-3xl max-h-[90vh] md:resize md:overflow-hidden md:min-w-[480px] md:min-h-[360px] md:max-w-[98vw] md:max-h-[96vh]"
        }
      >
        <DialogHeader>
          <DialogTitle>
            <div className="flex items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.notes.titlePh}
                className="text-xs flex-1"
              />
              <button
                type="button"
                onClick={() => setMaxed((v) => !v)}
                className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-md border border-input hover:bg-accent mr-6"
                title={maxed ? "Restaurar" : "Maximizar"}
                aria-label={maxed ? "Restaurar" : "Maximizar"}
              >
                {maxed ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              {ttsSupported() && (
                <SpeakButton
                  text={`${title}. ${htmlToPlainText(content)}`}
                  ariaLabel={s0.narrateNote}
                />
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {note.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <RichTextEditor
              value={content}
              onChange={setContent}
              toolbarStickyClass="sticky top-0 z-10"
            />
          )}
        </div>
        <DialogFooter className="gap-2">
          <div className="flex flex-wrap gap-2 sm:mr-auto">
            <NoteExportMenu title={title} html={content} />
            <Button
              variant="outline"
              onClick={() => setAiOpen(true)}
              disabled={note.isLoading || !content.trim()}
              title={sc.notes.aiFormat}
            >
              <Sparkles className="h-4 w-4 mr-1" /> {sc.notes.aiFormatBtn}
            </Button>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button onClick={save} disabled={saving || note.isLoading}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
      {noteId && (
        <AiFormatNoteDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          noteId={noteId}
          title={title}
          html={content}
          onApplied={(html) => setContent(html)}
        />
      )}
    </Dialog>
  );
}
