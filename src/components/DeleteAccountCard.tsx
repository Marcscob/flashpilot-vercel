import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount } from "@/lib/billing.functions";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

/** Exclusão definitiva da conta (LGPD), com confirmação por palavra. */
export function DeleteAccountCard() {
  const t = useT().profile;
  const del = useServerFn(deleteMyAccount);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = confirm.trim().toUpperCase() === t.dangerConfirmWord.toUpperCase();

  async function run() {
    setBusy(true);
    try {
      await del({ data: { confirm: confirm.trim() } } as any);
      toast.success(t.dangerDone);
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.dangerFail);
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
      <h2 className="flex items-center gap-2 font-serif text-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" /> {t.dangerTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.dangerDesc}</p>
      <div className="mt-4 max-w-sm space-y-2">
        <Label htmlFor="acc-delete">{t.dangerConfirmLabel}</Label>
        <Input
          id="acc-delete"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t.dangerConfirmWord}
          autoComplete="off"
        />
      </div>
      <Button className="mt-3" variant="destructive" disabled={!ready || busy} onClick={run}>
        {busy ? t.dangerWorking : t.dangerButton}
      </Button>
    </section>
  );
}
