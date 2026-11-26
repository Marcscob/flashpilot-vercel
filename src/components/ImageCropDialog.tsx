import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCw, Check, X } from "lucide-react";
import type { useBulkT } from "@/lib/i18n-bulk";

type Props = {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
  copy: ReturnType<typeof useBulkT>;
};

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

async function rotate90(src: string): Promise<string> {
  const img = await loadImg(src);
  const c = document.createElement("canvas");
  c.width = img.height;
  c.height = img.width;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return c.toDataURL("image/jpeg", 0.92);
}

const FULL: Crop = { unit: "%", x: 0, y: 0, width: 100, height: 100 };

export function ImageCropDialog({ open, imageSrc, onCancel, onConfirm, copy }: Props) {
  const [src, setSrc] = useState<string | null>(imageSrc);
  const [crop, setCrop] = useState<Crop>(FULL);
  const [pixels, setPixels] = useState<PixelCrop | null>(null);
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setSrc(imageSrc);
    setCrop(FULL);
    setPixels(null);
  }, [imageSrc, open]);

  async function handleConfirm() {
    const img = imgRef.current;
    if (!img || !src) return;
    setSaving(true);
    try {
      const sx = img.naturalWidth / img.width;
      const sy = img.naturalHeight / img.height;
      const selection = pixels && pixels.width > 4 && pixels.height > 4 ? pixels : null;
      const isFullImage =
        !selection ||
        (selection.x <= 1 &&
          selection.y <= 1 &&
          selection.width >= img.width - 2 &&
          selection.height >= img.height - 2);
      const p = isFullImage
        ? { x: 0, y: 0, width: img.width, height: img.height }
        : selection;
      const w = p.width * sx, h = p.height * sy;
      const scale = Math.min(1, 1600 / Math.max(w, h));
      const c = document.createElement("canvas");
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      const cctx = c.getContext("2d")!;
      cctx.fillStyle = "#fff";
      cctx.fillRect(0, 0, c.width, c.height);
      cctx.drawImage(img, p.x * sx, p.y * sy, w, h, 0, 0, c.width, c.height);
      onConfirm(c.toDataURL("image/jpeg", 0.85));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-4 pt-4 pb-2">
          <DialogTitle>{copy.cropTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-muted p-2">
          {src && (
            <ReactCrop
              crop={crop}
              onChange={(_, pc) => setCrop(pc)}
              onComplete={(c) => setPixels(c)}
              keepSelection
              className="max-h-full max-w-full"
            >
              <img
                ref={imgRef}
                src={src}
                alt=""
                className="block max-h-[calc(100dvh-12rem)] max-w-full object-contain"
                onLoad={() => { setCrop(FULL); setPixels(null); }}
              />
            </ReactCrop>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => { if (src) setSrc(await rotate90(src)); }}
          >
            <RotateCw className="h-4 w-4 mr-1" /> {copy.rotate}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> {copy.cancel}
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              <Check className="h-4 w-4 mr-1" /> {saving ? copy.saving : copy.applyCrop}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
