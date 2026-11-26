import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { descendantsOf, flattenTopicTree, indentTopicLabel } from "@/lib/topic-tree";
import { T } from "@/lib/i18n-ui";
import { useScreenT } from "@/lib/i18n-screens";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  topicId: string;
  topicName?: string;
  currentSubjectId?: string;
  onMoved?: () => void;
};

const ROOT = "__root__";

export function MoveTopicDialog({
  open,
  onOpenChange,
  topicId,
  topicName,
  currentSubjectId,
  onMoved,
}: Props) {
  const screenCopy = useScreenT();
  const copy = {
    title: screenCopy.fc.move,
    target: screenCopy.fc.targetSubject,
    select: screenCopy.fc.selectSubject,
    parent: screenCopy.fc.targetTopic,
    noParent: T("Sem pai (assunto raiz)"),
    cancel: screenCopy.fc.cancel,
    moving: screenCopy.fc.moving,
    move: screenCopy.fc.moveBtn,
    required: screenCopy.fc.selectSubject,
    invalid: T("Destino inválido: não pode ser o próprio item ou um descendente"),
    success: T("Movido com sucesso"),
    error: T("Erro ao mover"),
  };
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState<string>("");
  const [parentId, setParentId] = useState<string>(ROOT);

  useEffect(() => {
    if (open) {
      setSubjectId(currentSubjectId ?? "");
      setParentId(ROOT);
    }
  }, [open, currentSubjectId]);

  const subjects = useQuery({
    queryKey: ["move-subjects"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // All topics to compute descendants + available parents in chosen subject
  const allTopics = useQuery({
    queryKey: ["move-all-topics"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topics")
        .select("id, name, article_range, subject_id, parent_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  const descendantIds = useMemo(
    () => descendantsOf(allTopics.data ?? [], topicId),
    [allTopics.data, topicId],
  );

  const parentOptions = useMemo(() => {
    if (!subjectId) return [];
    const inSubject = (allTopics.data ?? []).filter((t) => t.subject_id === subjectId);
    return flattenTopicTree(inSubject).filter((t) => !descendantIds.has(t.id));
  }, [allTopics.data, subjectId, descendantIds]);

  const move = useMutation({
    mutationFn: async () => {
      if (!subjectId) throw new Error(copy.required);
      const newParent = parentId === ROOT ? null : parentId;
      if (newParent && descendantIds.has(newParent)) {
        throw new Error(copy.invalid);
      }
      // Update subject_id for the whole subtree
      const ids = Array.from(descendantIds);
      const { error: e1 } = await supabase
        .from("topics")
        .update({ subject_id: subjectId })
        .in("id", ids);
      if (e1) throw e1;
      // Update parent_id of the moving topic only
      const { error: e2 } = await supabase
        .from("topics")
        .update({ parent_id: newParent })
        .eq("id", topicId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success(copy.success);
      qc.invalidateQueries();
      onOpenChange(false);
      onMoved?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : copy.error),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!move.isPending) onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {copy.title} {topicName ? `“${topicName}”` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">{copy.target}</label>
            <Select
              value={subjectId}
              onValueChange={(v) => {
                setSubjectId(v);
                setParentId(ROOT);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={copy.select} />
              </SelectTrigger>
              <SelectContent>
                {(subjects.data ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">{copy.parent}</label>
            <Select value={parentId} onValueChange={setParentId} disabled={!subjectId}>
              <SelectTrigger>
                <SelectValue placeholder={copy.noParent} />
              </SelectTrigger>
              <SelectContent className="max-h-[50vh]">
                <SelectItem value={ROOT}>{copy.noParent}</SelectItem>
                {parentOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id} title={t.path}>
                    {indentTopicLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={move.isPending}>
            {copy.cancel}
          </Button>
          <Button onClick={() => move.mutate()} disabled={!subjectId || move.isPending}>
            {move.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {copy.moving}
              </>
            ) : (
              copy.move
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
