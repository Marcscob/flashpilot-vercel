import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import { FlagIcon } from "@/components/FlagIcon";

const NONE = "__none__";

type Props = {
  /** null = nenhum idioma definido (comportamento padrão do app). */
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  /** Texto da opção "sem idioma" — na matéria e no card o sentido é diferente. */
  noneLabel: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
};

export function LanguageSelect({ value, onChange, label, noneLabel, hint, disabled, className }: Props) {
  return (
    <div className={className}>
      {label && <label className="text-sm font-medium block mb-1">{label}</label>}
      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{noneLabel}</SelectItem>
          {SUPPORTED_LANGUAGES.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              <span className="inline-flex items-center gap-2">
                <FlagIcon flag={l.flag} />
                {l.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
