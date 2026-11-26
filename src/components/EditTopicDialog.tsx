import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceInput } from "@/components/VoiceInput";
import { useT } from "@/lib/i18n";

export type EditableTopic = {
  id: string;
  name: string;
  article_range?: string | null;
};

/** Diálogo para editar nome + intervalo de artigos de um assunto/subtópico/subitem. */
export function EditTopicDialog({
  topic,
  onClose,
  onSave,
  saving,
}: {
  topic: EditableTopic | null;
  onClose: () => void;
  onSave: (v: { id: string; name: string; article_range: string | null }) => void;
  saving?: boolean;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [art, setArt] = useState("");

  useEffect(() => {
    setName(topic?.name ?? "");
    setArt(topic?.article_range ?? "");
  }, [topic?.id]);

  return (
    <Dialog open={!!topic} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.subject.editTopic}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <VoiceInput label={t.subject.topicName} value={name} onChange={setName} minRows={2} />
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t.subject.articleRange}</label>
            <Input
              value={art}
              onChange={(e) => setArt(e.target.value.slice(0, 80))}
              placeholder={t.subject.articleRangePh}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || saving}
            onClick={() =>
              topic && onSave({ id: topic.id, name: name.trim(), article_range: art.trim() || null })
            }
          >
            {saving ? t.common.saving : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
