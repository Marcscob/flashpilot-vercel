import { T } from "@/lib/i18n-ui";
import { useEffect, useState } from "react";
import { getMindMapSignedUrl } from "@/lib/mindmap-image";
import { Loader2, ImageOff } from "lucide-react";

type Props = { path: string | null | undefined; className?: string };

export function MindMapImage({ path, className }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(null); setErr(false);
    if (!path) return;
    getMindMapSignedUrl(path)
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setErr(true); });
    return () => { alive = false; };
  }, [path]);

  if (!path) return null;
  if (err) {
    return (
      <div className={"flex items-center gap-2 text-xs opacity-70 " + (className ?? "")}>
        <ImageOff className="h-3.5 w-3.5" /> {T("Não foi possível carregar a imagem")}
      </div>
    );
  }
  if (!url) {
    return (
      <div className={"flex items-center justify-center py-4 " + (className ?? "")}>
        <Loader2 className="h-4 w-4 animate-spin opacity-70" />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={T("Mapa mental")}
      className={"w-full max-h-[60vh] object-contain rounded-xl select-none pointer-events-none " + (className ?? "")}
      draggable={false}
    />
  );
}
