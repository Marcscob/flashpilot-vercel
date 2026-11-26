import { Input } from "@/components/ui/input";
import { Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBulkT } from "@/lib/i18n-bulk";
import { useOverlayD } from "@/lib/i18n";

type Props = {
  video1: string | null;
  video2: string | null;
  onChange: (patch: { video1: string | null; video2: string | null }) => void;
  hideLabel?: boolean;
  placeholderFor?: (n: number) => string;
  hint?: string;
};

export function VideoLinksPicker({ video1, video2, onChange, hideLabel, placeholderFor, hint }: Props) {
  const b = useBulkT();
  const od = useOverlayD();
  const tpl = (k: string, n: number, fb: string) => od?.[`bulk.${k}`]?.replace("{n}", String(n)) ?? fb;
  return (
    <div className="space-y-2">
      {!hideLabel && <label className="text-sm font-medium flex items-center gap-2">
        <Video className="h-4 w-4 text-muted-foreground" />
        {b.videos}
      </label>}

      {[1, 2].map((n) => {
        const value = (n === 1 ? video1 : video2) ?? "";
        const set = (v: string) => {
          const next = v.trim() === "" ? null : v;
          onChange({
            video1: n === 1 ? next : video1,
            video2: n === 2 ? next : video2,
          });
        };
        return (
          <div key={n} className="flex items-center gap-2">
            <Input
              type="url"
              inputMode="url"
              placeholder={placeholderFor ? placeholderFor(n) : tpl("videoPlaceholderTpl", n, b.videoPlaceholder(n))}
              value={value}
              onChange={(e) => set(e.target.value)}
            />
            {value !== "" && (
              <Button type="button" variant="ghost" size="icon" onClick={() => set("")} aria-label={tpl("removeVideoTpl", n, b.removeVideo(n))}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground">
        {hint ?? b.videosHint}
      </p>
    </div>
  );
}
