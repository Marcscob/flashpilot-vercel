import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortedCountries, findCountry } from "@/lib/countries";
import { useLang, useT } from "@/lib/i18n";

/**
 * Telefone com seletor de país (prefixo internacional). Opcional por padrão.
 * `value` é apenas os dígitos locais; o pai guarda o país separado.
 */
export function PhoneField({
  country,
  onCountryChange,
  value,
  onChange,
  id = "phone",
}: {
  country: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChange: (digits: string) => void;
  id?: string;
}) {
  const { lang } = useLang();
  const t = useT().profile;
  const list = sortedCountries(lang);
  const dial = findCountry(country)?.dial ?? "";

  return (
    <div className="flex gap-2">
      <Select value={country} onValueChange={onCountryChange}>
        <SelectTrigger className="w-[150px] shrink-0" aria-label={t.country}>
          <SelectValue placeholder={t.country} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {list.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.flag} +{c.dial} {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {dial ? `+${dial}` : ""}
        </span>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          className={dial ? "pl-14" : undefined}
          placeholder={t.phonePh}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 15))}
        />
      </div>
    </div>
  );
}

/** Monta o valor E.164 a partir do país + dígitos locais. */
export function composePhone(country: string, local: string): string {
  const digits = local.replace(/\D/g, "");
  if (!digits) return "";
  const dial = findCountry(country)?.dial ?? "";
  return `+${dial}${digits}`;
}
