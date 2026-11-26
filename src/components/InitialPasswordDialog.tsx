import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getOwnPasswordStatus } from "@/lib/password-setup.functions";
import { shouldOfferInitialPassword } from "@/lib/password-setup-rules";
import { useTrialChoicePending } from "@/lib/trial-choice-gate";
import { passwordSetupCopy } from "@/lib/password-setup-i18n";
import { authFlowCopy } from "@/lib/auth-flow-i18n";
import { useLang, useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function InitialPasswordDialog({ userId }: { userId: string | null }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const getStatus = useServerFn(getOwnPasswordStatus);
  const { lang, extLang } = useLang();
  const t = useT();
  const fc = authFlowCopy(extLang ?? lang);
  const c = passwordSetupCopy(lang, Boolean(extLang));
  const [dismissedUser, setDismissedUser] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const status = useQuery({
    queryKey: ["own-password-status", userId],
    queryFn: () => getStatus(),
    enabled: Boolean(userId) && pathname !== "/reset-password",
    retry: false,
    staleTime: 60_000,
  });
  const trialChoicePending = useTrialChoicePending();
  const open = shouldOfferInitialPassword(userId, status.data?.hasPassword, pathname) && !trialChoicePending && dismissedUser !== userId;
  function dismiss() {
    if (saving) return;
    setDismissedUser(userId);
    setPassword("");
    setConfirmation("");
    setError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError(fc.mismatch); return; }
    setSaving(true);
    setError("");
    try {
      // Revalidate identity and status; never overwrite an existing password.
      const { data, error: identityError } = await supabase.auth.getUser();
      if (identityError || data.user?.id !== userId) throw new Error("Identity changed");
      const current = await getStatus();
      if (current.hasPassword) {
        setDismissedUser(userId);
        await status.refetch();
        return;
      }
      const { error: saveError } = await supabase.auth.updateUser({ password });
      if (saveError) throw saveError;
      // Close at once; the destination page is already loaded behind it.
      setDismissedUser(userId);
      void status.refetch();
      setPassword("");
      setConfirmation("");
      toast.success(fc.passwordUpdated);
    } catch {
      setError(c.error);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) dismiss(); }}>
      <DialogContent className="select-none" onCopy={(event) => event.preventDefault()} onCut={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{c.body}</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="initial-password">{fc.newPassword}</Label>
            <Input id="initial-password" type="password" autoComplete="new-password" required minLength={6} disabled={saving} value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="initial-password-confirm">{fc.confirmPassword}</Label>
            <Input id="initial-password-confirm" type="password" autoComplete="new-password" required minLength={6} disabled={saving} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={dismiss}>{c.later}</Button>
            <Button type="submit" disabled={saving}>{saving ? t.common.saving : fc.savePassword}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
