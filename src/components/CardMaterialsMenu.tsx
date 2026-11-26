import { useState } from "react";
import {
  Layers,
  Network,
  PlayCircle,
  FileText,
  ChevronRight,
  Tv,
  Clapperboard,
  NotebookPen,
  GitBranchPlus,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { T } from "@/lib/i18n-ui";
import { cn } from "@/lib/utils";

type Props = {
  hasNote: boolean;
  hasMap: boolean;
  videos: string[];
  onOpenNote?: () => void;
  onOpenMap?: () => void;
  onPlayLink?: (url: string) => void;
  tvVideos?: { id: string }[];
  onPlayTv?: (id: string) => void;
  onCreateVideo?: () => void;
  onCreateNote?: () => void;
  onCreateMap?: () => void;
  /** Incremented by the parent each time a material becomes ready; drives the badge blink. */
  pulseKey?: number;
  mobile?: boolean;
};

/**
 * One discreet trigger on the card back; materials open in a floating panel
 * so the answer, reference and example text stay fully readable.
 */
export function CardMaterialsMenu({
  hasNote,
  hasMap,
  videos,
  onOpenNote,
  onOpenMap,
  onPlayLink,
  tvVideos = [],
  onPlayTv,
  onCreateVideo,
  onCreateNote,
  onCreateMap,
  pulseKey = 0,
  mobile,
}: Props) {
  const [open, setOpen] = useState(false);
  const count = (hasNote ? 1 : 0) + (hasMap ? 1 : 0) + videos.length + tvVideos.length;
  if (count === 0 && !onCreateVideo && !onCreateNote && !onCreateMap) return null;
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const item = (
    key: string,
    icon: React.ReactNode,
    label: string,
    tone: string,
    onClick: () => void,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left text-base font-semibold text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        tone,
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-40 transition group-hover:translate-x-0.5" />
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative flex items-center justify-center rounded-full text-primary-foreground/90 hover:bg-primary-foreground/15",
            mobile ? "h-8 min-w-0 flex-1" : "p-1.5",
          )}
          aria-label={T("Materiais de estudo")}
          title={T("Materiais de estudo")}
        >
          <Layers className={mobile ? "h-5 w-5" : "h-4 w-4"} />
          {count > 0 && (
            <span
              key={pulseKey}
              className={cn(
                "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-foreground px-1 text-[9px] font-bold text-primary",
                pulseKey > 0 && "badge-blink-red",
              )}
            >
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        onClick={(e) => e.stopPropagation()}
        className="w-72 rounded-3xl border bg-popover/95 p-3 shadow-xl backdrop-blur"
      >
        <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {T("Materiais de estudo")}
        </p>
        <div className="space-y-2.5">
          {onCreateMap &&
            item(
              "create-map",
              <GitBranchPlus className="h-6 w-6 text-primary" />,
              T("Criar mapa mental"),
              "border-dashed border-primary/50",
              pick(onCreateMap),
            )}
          {onCreateVideo &&
            item(
              "create",
              <Clapperboard className="h-6 w-6 text-primary" />,
              T("Criar microvídeo"),
              "border-dashed border-primary/50",
              pick(onCreateVideo),
            )}
          {onCreateNote &&
            item(
              "create-note",
              <NotebookPen className="h-6 w-6 text-primary" />,
              T("Criar anotação"),
              "border-dashed border-primary/50",
              pick(onCreateNote),
            )}
          {hasMap &&
            onOpenMap &&
            item(
              "map",
              <Network className="h-6 w-6 text-primary" />,
              T("Mapa/Imagem"),
              "border-primary/40 bg-primary/5",
              pick(onOpenMap),
            )}
          {videos.map(
            (v, i) =>
              onPlayLink &&
              item(
                `v-${i}`,
                <PlayCircle className="h-6 w-6 text-accent" />,
                videos.length > 1 ? T("Vídeo {n}", { n: i + 1 }) : T("Vídeo"),
                "border-accent/40 bg-accent/5",
                pick(() => onPlayLink(v)),
              ),
          )}
          {tvVideos.map((v, i) =>
            item(
              `tv-${v.id}`,
              <Tv className="h-6 w-6 text-accent" />,
              `FlashPilot-TV${tvVideos.length > 1 ? ` ${i + 1}` : ""}`,
              "border-accent/40 bg-accent/10",
              pick(() => onPlayTv?.(v.id)),
            ),
          )}
          {hasNote &&
            onOpenNote &&
            item(
              "note",
              <FileText className="h-6 w-6 text-secondary-foreground" />,
              T("Ver anotação"),
              "border-secondary-foreground/25 bg-secondary/40",
              pick(onOpenNote),
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
