import { useCallback, useEffect, useRef, useState } from "react";
import { T } from "@/lib/i18n-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getMindMapSignedUrl } from "@/lib/mindmap-image";
import { Loader2, ImageOff, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

type Props = {
  path: string | null | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
};

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;
const FIT_PADDING = 16;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function MindMapViewerDialog({ path, open, onOpenChange, title }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fitted, setFitted] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };
  const dragRef = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setUrl(null);
    setErr(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setFitted(false);
    if (!path) return;
    getMindMapSignedUrl(path)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        if (alive) setErr(true);
      });
    return () => {
      alive = false;
    };
  }, [path, open]);

  const zoomAt = useCallback((nextZoomRaw: number, px: number, py: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const next = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
    const k = next / z;
    setZoom(next);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const { zoom: z } = stateRef.current;
      zoomAtRef.current(z * Math.exp(-dy * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, url]);

  function zoomByButton(factor: number) {
    const el = viewportRef.current;
    const rect = el?.getBoundingClientRect();
    const px = rect ? rect.width / 2 : 0;
    const py = rect ? rect.height / 2 : 0;
    zoomAt(stateRef.current.zoom * factor, px, py);
  }

  const fitToView = useCallback((attempt = 0) => {
    const el = viewportRef.current;
    const img = imgRef.current;
    if (!el || !img || !img.naturalWidth || !img.naturalHeight) {
      if (attempt < 30) requestAnimationFrame(() => fitToView(attempt + 1));
      return;
    }
    const rect = el.getBoundingClientRect();
    const vw = rect.width - FIT_PADDING * 2;
    const vh = rect.height - FIT_PADDING * 2;
    if (vw <= 0 || vh <= 0) {
      if (attempt < 30) requestAnimationFrame(() => fitToView(attempt + 1));
      return;
    }
    const scale = clamp(
      Math.min(vw / img.naturalWidth, vh / img.naturalHeight, 1),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    setZoom(scale);
    setOffset({
      x: (rect.width - img.naturalWidth * scale) / 2,
      y: (rect.height - img.naturalHeight * scale) / 2,
    });
    setFitted(true);
  }, []);

  const fitRef = useRef(fitToView);
  fitRef.current = fitToView;

  // Reajusta ao redimensionar a janela/viewport enquanto o usuário não interagiu
  useEffect(() => {
    if (!open || !url) return;
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!dragRef.current) fitRef.current();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, url]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      const [p1, p2] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
        cx: (p1.x + p2.x) / 2,
        cy: (p1.y + p2.y) / 2,
      };
      dragRef.current = null;
      setDragging(false);
      return;
    }
    if (pointersRef.current.size === 1) {
      dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      setDragging(true);
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [p1, p2] = [...pointersRef.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const rect = viewportRef.current?.getBoundingClientRect();
      const prev = pinchRef.current;
      const k = dist / prev.dist;
      const { zoom: z, offset: o } = stateRef.current;
      const px = cx - (rect?.left ?? 0);
      const py = cy - (rect?.top ?? 0);
      const next = clamp(z * k, MIN_ZOOM, MAX_ZOOM);
      const s = next / z;
      // zoom ancorado no centro da pinça + pan pelo deslocamento do centro
      setZoom(next);
      setOffset({
        x: px - (px - o.x) * s + (cx - prev.cx),
        y: py - (py - o.y) * s + (cy - prev.cy),
      });
      pinchRef.current = { dist, cx, cy };
      return;
    }

    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  }
  function endDrag(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      const [id, p] = [...pointersRef.current.entries()][0];
      const { offset: o } = stateRef.current;
      dragRef.current = { id, x: p.x, y: p.y, ox: o.x, oy: o.y };
      setDragging(true);
      return;
    }
    if (dragRef.current?.id === e.pointerId || pointersRef.current.size === 0) {
      dragRef.current = null;
      setDragging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="truncate">{title ?? T("Mapa mental")}</DialogTitle>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => zoomByButton(1 / 1.25)}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground"
                aria-label={T("Diminuir zoom")}
                title={T("Diminuir zoom")}
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs tabular-nums w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => zoomByButton(1.25)}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground"
                aria-label={T("Aumentar zoom")}
                title={T("Aumentar zoom")}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => fitToView()}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground"
                aria-label={T("Ajustar à tela")}
                title={T("Ajustar à tela")}
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>
        <div
          ref={viewportRef}
          className="relative bg-muted/30 overflow-hidden touch-none"
          style={{
            height: "min(80dvh, 80vh)",
            minHeight: "260px",
            cursor: url ? (dragging ? "grabbing" : "grab") : "default",
          }}
          onPointerDown={url ? onPointerDown : undefined}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {err ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <ImageOff className="h-4 w-4" /> {T("Não foi possível carregar a imagem")}
            </div>
          ) : !url ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin opacity-70" />
            </div>
          ) : (
            <img
              ref={imgRef}
              src={url}
              alt={T("Mapa mental")}
              draggable={false}
              onLoad={() => fitToView()}
              className="select-none max-w-none absolute top-0 left-0 origin-top-left transition-opacity"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                opacity: fitted ? 1 : 0,
              }}
            />
          )}
        </div>
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          {T("Arraste para mover • Rolagem do mouse ou pinça com dois dedos para zoom")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
