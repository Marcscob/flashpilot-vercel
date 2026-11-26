import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { T } from "@/lib/i18n-ui";
import { isValidWebPageUrl } from "@/lib/web-page-text";
import { WEB_PAGES_BULK_MAX, parseWebUrls } from "@/lib/web-page-urls";

export function WebPageSourceInput({ value, onChange, disabled = false, max = 1 }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; max?: number;
}) {
  if (max <= 1) {
    const invalid = value.trim() !== "" && !isValidWebPageUrl(value);
    return <div className="space-y-2">
      <Label htmlFor="web-source">{T("Página da Web")}</Label>
      <Input id="web-source" type="url" value={value} onChange={(event) => onChange(event.target.value)}
        disabled={disabled} placeholder={T("Cole o link da página da web")} aria-invalid={invalid} maxLength={2048} />
      {invalid && <p role="alert" className="text-sm text-destructive">{T("Link de página da web inválido")}</p>}
    </div>;
  }
  const limit = Math.min(max, WEB_PAGES_BULK_MAX);
  const urls = parseWebUrls(value);
  const hasInvalid = urls.some((url) => !isValidWebPageUrl(url));
  const tooMany = urls.length > limit;
  return <div className="space-y-2">
    <Label htmlFor="web-source">{T("Página da Web")}</Label>
    <Textarea id="web-source" value={value} onChange={(event) => onChange(event.target.value)}
      disabled={disabled} rows={5} placeholder={T("Cole até {n} links de páginas da web, um por linha", { n: limit })}
      aria-invalid={hasInvalid || tooMany} maxLength={limit * 2100} />
    <p className="text-xs text-muted-foreground">{urls.length}/{limit}</p>
    {hasInvalid && <p role="alert" className="text-sm text-destructive">{T("Link de página da web inválido")}</p>}
    {tooMany && <p role="alert" className="text-sm text-destructive">{T("Máximo de {n} páginas por vez", { n: limit })}</p>}
  </div>;
}
