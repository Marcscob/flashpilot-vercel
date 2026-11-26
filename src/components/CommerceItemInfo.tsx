import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CommerceItemInfo({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="ml-auto h-8 w-8 shrink-0 text-muted-foreground" aria-label={label} title={label}>
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} className="max-w-[calc(100vw-2rem)] text-sm" align="end">
        <p className={children ? "mb-2 font-medium" : "font-medium"}>{label}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}