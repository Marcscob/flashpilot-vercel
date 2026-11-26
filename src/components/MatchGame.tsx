import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Check, ChevronLeft, ChevronRight, RotateCcw, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { T } from "@/lib/i18n-ui";
import { cn } from "@/lib/utils";
import { shuffledOrder, type MatchRound } from "@/lib/match-game";

type Flash = { left: number; right: number; ok: boolean } | null;
type RoundProgress = { solved: number[]; mistakes: number };

const FLASH_MS = 700;

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

const stateClass = (solved: boolean, flash: "ok" | "wrong" | null, selected: boolean) =>
  cn(
    "relative flex min-h-14 w-full items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left text-sm leading-snug break-words transition-colors",
    solved && "border-green-500 bg-green-500/15 text-foreground",
    !solved &&
      flash === "ok" &&
      "animate-pulse border-green-500 bg-green-500/25 ring-2 ring-green-500",
    !solved &&
      flash === "wrong" &&
      "animate-pulse border-destructive bg-destructive/15 ring-2 ring-destructive",
    !solved && !flash && selected && "border-primary bg-primary/10 ring-2 ring-primary/50",
    !solved && !flash && !selected && "border-border hover:border-primary/50 hover:bg-accent/40",
  );

function LeftItem(props: {
  index: number;
  text: string;
  solved: boolean;
  flash: "ok" | "wrong" | null;
  selected: boolean;
  onTap: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `L${props.index}`,
    disabled: props.solved,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={props.solved}
      onClick={props.onTap}
      {...attributes}
      {...listeners}
      aria-pressed={props.selected}
      className={cn(
        stateClass(props.solved, props.flash, props.selected),
        !props.solved && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      {props.solved && <Check className="h-4 w-4 shrink-0 text-green-600" />}
      <span className="min-w-0 flex-1 font-medium">{props.text}</span>
    </button>
  );
}

function RightItem(props: {
  pairIndex: number;
  text: string;
  solved: boolean;
  flash: "ok" | "wrong" | null;
  armed: boolean;
  onTap: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `R${props.pairIndex}`,
    disabled: props.solved,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={props.solved}
      onClick={props.onTap}
      className={cn(
        stateClass(props.solved, props.flash, false),
        !props.solved && props.armed && "border-primary/60",
        !props.solved && isOver && "border-primary bg-primary/10 ring-2 ring-primary/50",
      )}
    >
      {props.solved && <Check className="h-4 w-4 shrink-0 text-green-600" />}
      <span className="min-w-0 flex-1">{props.text}</span>
    </button>
  );
}

export function MatchGame({ rounds, seedKey }: { rounds: MatchRound[]; seedKey: string }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<RoundProgress[]>(() =>
    rounds.map(() => ({ solved: [], mistakes: 0 })),
  );
  const [flash, setFlash] = useState<Flash>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const flashTimer = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(
    () => () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  const round = rounds[index]!;
  const current = progress[index]!;
  const rightOrder = useMemo(
    () => shuffledOrder(round.pairs.length, hashSeed(`${seedKey}:${index}`)),
    [round.pairs.length, seedKey, index],
  );
  const roundDone = current.solved.length === round.pairs.length;
  const allDone = progress.every((p, i) => p.solved.length === rounds[i]!.pairs.length);
  const totalMistakes = progress.reduce((sum, p) => sum + p.mistakes, 0);

  const attempt = useCallback(
    (left: number, right: number) => {
      if (current.solved.includes(left)) return;
      const ok = left === right;
      setFlash({ left, right, ok });
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(null), FLASH_MS);
      setSelected(null);
      setAnnouncement(ok ? T("Correto!") : T("Não é esse par. Tente de novo."));
      setProgress((all) =>
        all.map((p, i) =>
          i !== index
            ? p
            : ok
              ? { ...p, solved: [...p.solved, left] }
              : { ...p, mistakes: p.mistakes + 1 },
        ),
      );
    },
    [current.solved, index],
  );

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const from = String(event.active.id);
    const to = event.over ? String(event.over.id) : "";
    if (!from.startsWith("L") || !to.startsWith("R")) return;
    attempt(Number(from.slice(1)), Number(to.slice(1)));
  }

  function go(next: number) {
    setIndex(Math.max(0, Math.min(rounds.length - 1, next)));
    setSelected(null);
    setFlash(null);
  }

  function nextOpenRound(): number {
    const open = (i: number) => progress[i]!.solved.length < rounds[i]!.pairs.length;
    const after = rounds.findIndex((_, i) => i > index && open(i));
    return after >= 0
      ? after
      : Math.max(
          0,
          rounds.findIndex((_, i) => open(i)),
        );
  }

  function restart() {
    setProgress(rounds.map(() => ({ solved: [], mistakes: 0 })));
    go(0);
  }

  const draggedPair = draggingId ? round.pairs[Number(draggingId.slice(1))] : null;
  const flashFor = (side: "left" | "right", i: number): "ok" | "wrong" | null =>
    flash && flash[side] === i ? (flash.ok ? "ok" : "wrong") : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={T("Rodada anterior")}
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="text-sm font-semibold">
            {T("Rodada")} {index + 1} / {rounds.length}
          </p>
          <div className="mt-1 flex justify-center gap-1.5" aria-hidden="true">
            {rounds.map((r, i) => {
              const done = progress[i]!.solved.length === r.pairs.length;
              return (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  onClick={() => go(i)}
                  className={cn(
                    "h-2 w-2 rounded-full transition-all",
                    i === index
                      ? "w-5 bg-primary"
                      : done
                        ? "bg-green-500"
                        : "bg-muted-foreground/30",
                  )}
                />
              );
            })}
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label={T("Próxima rodada")}
          disabled={index === rounds.length - 1}
          onClick={() => go(index + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {T("Arraste cada conceito até a sua explicação (ou toque em um de cada coluna).")}
      </p>

      <DndContext
        sensors={sensors}
        onDragStart={(e) => {
          setDraggingId(String(e.active.id));
          setSelected(null);
        }}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={onDragEnd}
      >
        <div key={index} className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
          <div className="space-y-2">
            {round.pairs.map((pair, i) => (
              <LeftItem
                key={`l${i}`}
                index={i}
                text={pair.left}
                solved={current.solved.includes(i)}
                flash={flashFor("left", i)}
                selected={selected === i}
                onTap={() => setSelected((s) => (s === i ? null : i))}
              />
            ))}
          </div>
          <div className="space-y-2">
            {rightOrder.map((pairIndex) => (
              <RightItem
                key={`r${pairIndex}`}
                pairIndex={pairIndex}
                text={round.pairs[pairIndex]!.right}
                solved={current.solved.includes(pairIndex)}
                flash={flashFor("right", pairIndex)}
                armed={selected !== null}
                onTap={() => {
                  if (selected !== null) attempt(selected, pairIndex);
                }}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {draggedPair ? (
            <div className="flex min-h-14 items-center rounded-xl border border-primary bg-card px-3 py-2.5 text-sm font-medium shadow-lg">
              {draggedPair.left}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {flash && !flash.ok && (
        <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-destructive">
          <X className="h-4 w-4" />
          {T("Não é esse par. Tente de novo.")}
        </p>
      )}

      {roundDone && !allDone && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 p-3">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            {T("Rodada concluída!")}
          </p>
          <Button onClick={() => go(nextOpenRound())}>
            {T("Próxima rodada")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {allDone && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-4 text-center">
          <Trophy className="h-8 w-8 text-amber-500" />
          <p className="font-serif text-lg">{T("Você combinou todos os pares!")}</p>
          <p className="text-sm text-muted-foreground">
            {totalMistakes === 0
              ? T("Sem nenhum erro. Excelente!")
              : `${T("Tentativas erradas:")} ${totalMistakes}`}
          </p>
          <Button variant="outline" onClick={restart}>
            <RotateCcw className="h-4 w-4" />
            {T("Jogar de novo")}
          </Button>
        </div>
      )}
    </div>
  );
}
