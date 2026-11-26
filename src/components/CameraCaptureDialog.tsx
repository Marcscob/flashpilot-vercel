import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, SwitchCamera, X } from "lucide-react";
import { T } from "@/lib/i18n-ui";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCapture: (file: File) => void;
  title: string;
  labels?: Partial<{
    switchCamera: string;
    cancel: string;
    capture: string;
    unavailable: string;
  }>;
};

export function CameraCaptureDialog({ open, onOpenChange, onCapture, title, labels }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const copy = {
    switchCamera: labels?.switchCamera ?? T("Trocar câmera"),
    cancel: labels?.cancel ?? T("Cancelar"),
    capture: labels?.capture ?? T("Capturar"),
    unavailable:
      labels?.unavailable ??
      T("Não foi possível acessar a câmera. Verifique a permissão do navegador."),
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!getUserMedia) {
      setError(copy.unavailable);
      return;
    }
    void getUserMedia({
      video: {
        facingMode: { ideal: facing },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError(copy.unavailable));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [copy.unavailable, facing, open]);

  function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="bg-muted flex items-center justify-center min-h-[40vh]">
          {error ? (
            <p className="p-6 text-sm text-muted-foreground text-center">{error}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[60vh] w-full object-contain"
            />
          )}
        </div>
        <DialogFooter className="px-4 py-3 gap-2 border-t border-border sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          >
            <SwitchCamera className="h-4 w-4 mr-1" /> {copy.switchCamera}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-1" /> {copy.cancel}
            </Button>
            <Button onClick={snap} disabled={!!error}>
              <Camera className="h-4 w-4 mr-1" /> {copy.capture}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
