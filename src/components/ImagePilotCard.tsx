import { useEffect, useState } from "react";
import { getMindMapSignedUrl } from "@/lib/mindmap-image";
import { cn } from "@/lib/utils";

export type ImagePilotPin = {
  n: number;
  label: string;
  x: number; // 0-1000 relativo à largura da imagem
  y: number; // 0-1000 relativo à altura da imagem
  confidence?: number;
};

type Props = {
  imagePath: string;
  pins: ImagePilotPin[];
  /** Número do marcador em destaque (modo "um card por estrutura"). */
  focus?: number | null;
  /** front = imagem com marcadores; back = miniatura da imagem. */
  face: "front" | "back";
  className?: string;
};

/** Imagem do ImagePilot com os marcadores numerados posicionados em porcentagem. */
export function ImagePilotCard({ imagePath, pins, focus, face, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    getMindMapSignedUrl(imagePath)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => {
        if (alive) setUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [imagePath]);

  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-muted/40 text-xs text-muted-foreground",
          face === "front" ? "h-40" : "h-20",
          className,
        )}
      >
        …
      </div>
    );
  }

  // Imagem sempre inteira: cabe na altura máxima do card, mantendo proporção.
  // O contêiner encolhe para o tamanho exato da imagem, então os marcadores
  // continuam alinhados.
  return (
    <div className={cn("relative mx-auto w-fit max-w-full select-none", className)}>
      <img
        src={url}
        alt=""
        draggable={false}
        className={cn(
          "block h-auto w-auto max-w-full rounded-xl object-contain",
          face === "front" ? "max-h-[min(58dvh,560px)]" : "max-h-[min(52dvh,520px)] border border-primary-foreground/25 bg-background",
        )}
      />
      <div className="pointer-events-none absolute inset-0">
        {pins.map((pin) => {
          const isFocused = focus != null && pin.n === focus;
          const dimmed = focus != null && pin.n !== focus;
          return (
            <span
              key={pin.n}
              className={cn(
                "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold shadow-md",
                isFocused
                  ? "z-10 scale-125 border-white bg-accent/60 text-accent-foreground [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]"
                  : "border-white/90 bg-primary text-primary-foreground",
                dimmed && "opacity-35",
              )}
              style={{ left: `${pin.x / 10}%`, top: `${pin.y / 10}%` }}
            >
              {pin.n}
            </span>
          );
        })}
      </div>
    </div>
  );
}
