import { useId, useState } from "react";
import { Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { T } from "@/lib/i18n-ui";

/** Opção do Bulk v2 para criar também o jogo de combinação (FlashMatch) a partir dos flashcards. */
export function FlashMatchOption(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const explanation = T(
    "O FlashMatch criará um game de combinação em colunas para que você pratique o assunto associando conceitos e respostas.",
  );
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={(value) => props.onChange(value === true)}
      />
      <label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
        {T("Incluir FlashMatch")}
      </label>
      <TooltipProvider delayDuration={100}>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={explanation}
              onClick={() => setOpen((value) => !value)}
              className="rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-pretty">
            {explanation}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
