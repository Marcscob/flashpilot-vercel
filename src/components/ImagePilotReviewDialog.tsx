import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { T } from "@/lib/i18n-ui";
import { cn } from "@/lib/utils";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { ImagePilotPin } from "./ImagePilotCard";

export type ImagePilotConfirm = {
  pins: ImagePilotPin[];
  generatedOutputIds: Array<string | null>;
  mode: "single" | "per-item";
  subjectName: string;
  topicName: string;
};

type Props = {
  open: boolean;
  imageDataUrl: string;
  initialPins: ImagePilotPin[];
  initialOutputIds: string[];
  suggestedSubject: string | null;
  suggestedTopic: string | null;
  saving: boolean;
  onConfirm: (result: ImagePilotConfirm) => void;
  onCancel: () => void;
};

const LOW_CONFIDENCE = 0.6;
const MAX_PINS = 30;
type ReviewPin = ImagePilotPin & { generatedOutputId?: string };

/** Tela de conferência do ImagePilot: editar, mover, apagar e adicionar marcadores antes de salvar. */
export function ImagePilotReviewDialog({
  open,
  imageDataUrl,
  initialPins,
  initialOutputIds,
  suggestedSubject,
  suggestedTopic,
  saving,
  onConfirm,
  onCancel,
}: Props) {
  const [pins, setPins] = useState<ReviewPin[]>(
    initialPins.map((pin, index) => ({
      ...pin,
      generatedOutputId: initialOutputIds[index],
    })),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<"single" | "per-item">("per-item");
  const [subjectName, setSubjectName] = useState(suggestedSubject ?? "");
  const [topicName, setTopicName] = useState(suggestedTopic ?? "");
  const imgWrapRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<number | null>(null);

  function renumber(list: ReviewPin[]): ReviewPin[] {
    return list.map((p, i) => ({ ...p, n: i + 1 }));
  }

  function coordsFromEvent(e: React.PointerEvent): { x: number; y: number } | null {
    const wrap = imgWrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 1000);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 1000);
    return { x: Math.min(1000, Math.max(0, x)), y: Math.min(1000, Math.max(0, y)) };
  }

  function handleImagePointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    if (pins.length >= MAX_PINS) return;
    const pos = coordsFromEvent(e);
    if (!pos) return;
    const next = renumber([...pins, { n: pins.length + 1, label: "", ...pos, confidence: 1 }]);
    setPins(next);
    setSelected(next.length - 1);
  }

  function handlePinPointerDown(e: React.PointerEvent, index: number) {
    e.stopPropagation();
    setSelected(index);
    dragRef.current = index;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const index = dragRef.current;
    if (index === null) return;
    const pos = coordsFromEvent(e);
    if (!pos) return;
    setPins((prev) => prev.map((p, i) => (i === index ? { ...p, ...pos } : p)));
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function updateLabel(index: number, label: string) {
    setPins((prev) => prev.map((p, i) => (i === index ? { ...p, label } : p)));
  }

  function removePin(index: number) {
    setPins((prev) => renumber(prev.filter((_, i) => i !== index)));
    setSelected(null);
  }

  const valid = pins.length > 0 && pins.every((p) => p.label.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onCancel(); }}>
      <DialogContent className="max-w-3xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{T("Conferir o ImagePilot")}</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{T("O PilotAI pode errar. Confira os nomes e as posições antes de salvar.")}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          {T("Toque na imagem para adicionar um marcador; arraste um marcador para movê-lo.")}
        </p>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div
            ref={imgWrapRef}
            className="relative w-full cursor-crosshair select-none touch-none"
            onPointerDown={handleImagePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              src={imageDataUrl}
              alt=""
              draggable={false}
              className="block h-auto w-full rounded-xl object-contain"
            />
            <div className="absolute inset-0">
              {pins.map((pin, i) => (
                <button
                  key={i}
                  data-pin
                  type="button"
                  onPointerDown={(e) => handlePinPointerDown(e, i)}
                  className={cn(
                    "absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 text-xs font-bold shadow-md active:cursor-grabbing",
                    selected === i
                      ? "border-white bg-accent text-accent-foreground"
                      : "border-white/90 bg-primary text-primary-foreground",
                    (pin.confidence ?? 1) < LOW_CONFIDENCE && "ring-2 ring-amber-400",
                  )}
                  style={{ left: `${pin.x / 10}%`, top: `${pin.y / 10}%` }}
                  aria-label={`${T("Marcador")} ${pin.n}`}
                >
                  {pin.n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto sm:max-h-none">
            {pins.map((pin, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border p-1.5",
                  selected === i ? "border-primary" : "border-border",
                )}
                onClick={() => setSelected(i)}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground",
                    (pin.confidence ?? 1) < LOW_CONFIDENCE && "ring-2 ring-amber-400",
                  )}
                  title={(pin.confidence ?? 1) < LOW_CONFIDENCE ? T("Verificar: o PilotAI não tem certeza deste nome.") : undefined}
                >
                  {pin.n}
                </span>
                <input
                  value={pin.label}
                  onChange={(e) => updateLabel(i, e.target.value)}
                  placeholder={T("Nome da estrutura")}
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePin(i); }}
                  className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                  aria-label={T("Remover marcador")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={pins.length >= MAX_PINS}
              onClick={() => {
                if (pins.length >= MAX_PINS) return;
                const next = renumber([...pins, { n: pins.length + 1, label: "", x: 500, y: 500, confidence: 1 }]);
                setPins(next);
                setSelected(next.length - 1);
              }}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> {T("Adicionar marcador")}
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">{T("Matéria")}</span>
            <input
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-muted-foreground">{T("Assunto")}</span>
            <input
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="radio"
              name="imagepilot-mode"
              checked={mode === "per-item"}
              onChange={() => setMode("per-item")}
              className="mt-0.5 accent-current"
            />
            <span>
              <strong>{T("Um card por estrutura")}</strong> —{" "}
              {T("cada número vira um card separado, com revisão individual.")}
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="radio"
              name="imagepilot-mode"
              checked={mode === "single"}
              onChange={() => setMode("single")}
              className="mt-0.5 accent-current"
            />
            <span>
              <strong>{T("Card único")}</strong> —{" "}
              {T("a imagem numerada na frente e a legenda completa no verso.")}
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            {T("Descartar")}
          </Button>
          <Button
            disabled={!valid || saving || !subjectName.trim() || !topicName.trim()}
            onClick={() =>
              onConfirm({
                pins: pins.map(({ n, label, x, y, confidence }) => ({ n, label, x, y, confidence })),
                generatedOutputIds: pins.map((pin) => pin.generatedOutputId ?? null),
                mode,
                subjectName: subjectName.trim(),
                topicName: topicName.trim(),
              })
            }
          >
            {saving ? T("Salvando…") : T("Salvar flashcards")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
