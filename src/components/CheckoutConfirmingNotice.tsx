import { Loader2 } from "lucide-react";

/** Aviso enquanto o app espera a aprovação do pagamento pelo provedor. */
export function CheckoutConfirmingNotice({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {label}
    </div>
  );
}
