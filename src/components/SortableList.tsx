import type { ReactNode } from "react";
import { T } from "@/lib/i18n-ui";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type SortableListProps = {
  ids: string[];
  disabled?: boolean;
  onReorder: (ids: string[]) => void;
  children: ReactNode;
  className?: string;
  /** "grid" libera arrasto em qualquer direção (cards em colunas). */
  layout?: "vertical" | "grid";
};

export function SortableList({
  ids,
  disabled,
  onReorder,
  children,
  className,
  layout = "vertical",
}: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(ids, from, to));
  }

  if (disabled) return <div className={className}>{children}</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={
        layout === "grid"
          ? [restrictToParentElement]
          : [restrictToVerticalAxis, restrictToParentElement]
      }
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ids}
        strategy={layout === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
      >
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
}

type SortableItemProps = {
  id: string;
  disabled?: boolean;
  children: (handle: ReactNode) => ReactNode;
};

export function SortableItem({ id, disabled, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={T("Arrastar para reordenar")}
      title={disabled ? T("Arrasto indisponível nesta visualização") : T("Arraste para reordenar")}
      className={cn(
        "shrink-0 mt-0.5 p-1 rounded-md text-muted-foreground touch-none",
        disabled
          ? "opacity-30 cursor-not-allowed"
          : "cursor-grab active:cursor-grabbing hover:bg-muted",
      )}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  if (disabled) {
    return <>{children(handle)}</>;
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-70 z-10 relative")}
    >
      {children(handle)}
    </div>
  );
}
