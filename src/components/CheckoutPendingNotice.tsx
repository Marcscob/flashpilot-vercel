import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Aviso exibido quando o pagamento falha porque a cobrança real ainda não foi liberada. */
export function CheckoutPendingNotice({ show }: { show: boolean }) {
  const t = useT().checkout;
  if (!show) return null;

  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{t.noticeTitle}</p>
        <p className="text-xs opacity-90">{t.noticeBody}</p>
      </div>
    </div>
  );
}
