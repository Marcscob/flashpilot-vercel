import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { T } from "@/lib/i18n-ui";
import { canonicalYoutubeUrl } from "@/lib/youtube-url";

export function YouTubeSourceInput({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const invalid = value.trim() !== "" && !canonicalYoutubeUrl(value);
  return <div className="space-y-2">
    <Label htmlFor="youtube-source">YouTube</Label>
    <Input id="youtube-source" type="url" value={value} onChange={(event) => onChange(event.target.value)}
      disabled={disabled} placeholder={T("Cole o link do YouTube")} aria-invalid={invalid} maxLength={2048} />
    {invalid && <p role="alert" className="text-sm text-destructive">{T("Link do YouTube inválido")}</p>}
  </div>;
}