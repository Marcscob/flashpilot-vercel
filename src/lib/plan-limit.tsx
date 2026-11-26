import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { claimTrialExtension } from "@/lib/trial.functions";
import { T } from "@/lib/i18n-ui";
import { supabase } from "@/integrations/supabase/client";
import { useState, createContext, useContext, useCallback, type ReactNode } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSubscription } from "@/hooks/useSubscription";
import { isAppManagerIdentity, OWNER_EMAIL } from "@/lib/app-manager";

export { OWNER_EMAIL };
export const FREE_LIMIT = 100;
export const CONTACT_EMAIL = "contact@flashpilot.net";
export const CONTACT_WHATSAPP_DISPLAY = "";
export const CONTACT_WHATSAPP_LINK = "";

export function usePlanLimit() {
  const me = useQuery({
    queryKey: ["me-email"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user
        ? { email: data.user.email ?? null, isAppManager: isAppManagerIdentity(data.user) }
        : null;
    },
    staleTime: 60_000,
  });

  const count = useQuery({
    queryKey: ["my-flashcards-count"],
    queryFn: async () => {
      // Cards recebidos em matéria comprada não contam no limite do plano gratuito.
      const { count, error } = await supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .is("source_id", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const extra = useQuery({
    queryKey: ["trial-card-bonus"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("trial_bonus_flashcards, trial_extension_granted_at")
        .maybeSingle();
      return {
        bonus: data?.trial_bonus_flashcards ?? 0,
        extensionGranted: !!data?.trial_extension_granted_at,
      };
    },
  });

  const { isActive: hasSubscription, loading: subLoading } = useSubscription();

  const isOwner = me.data?.isAppManager ?? false;
  const total = count.data ?? 0;
  const unlimited = isOwner || hasSubscription;
  const limit = FREE_LIMIT + (extra.data?.bonus ?? 0);
  const remaining = unlimited ? Infinity : Math.max(0, limit - total);
  const canCreate = (n = 1) => unlimited || total + n <= limit;

  return {
    isOwner,
    isAppManager: isOwner,
    hasSubscription,
    // A criação de flashcards é aberta a todos (manual e CSV rodam no navegador).
    canUseBulk: true,
    // Free users can use AI: welcome-kit quotas, FlashCoins and budget are enforced server-side.
    canUseAI: true,
    total,
    limit,
    extensionGranted: extra.data?.extensionGranted ?? false,
    remaining,
    canCreate,
    loading: me.isLoading || count.isLoading || subLoading,
  };
}

type Ctx = { show: () => void };
const LimitCtx = createContext<Ctx>({ show: () => {} });

export function useUpgradeDialog() {
  return useContext(LimitCtx);
}

export function UpgradeDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const qc = useQueryClient();
  const claimFn = useServerFn(claimTrialExtension);
  const extension = useQuery({
    queryKey: ["trial-card-bonus"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("trial_bonus_flashcards, trial_extension_granted_at")
        .maybeSingle();
      return {
        bonus: data?.trial_bonus_flashcards ?? 0,
        extensionGranted: !!data?.trial_extension_granted_at,
      };
    },
  });
  const granted = extension.data?.extensionGranted ?? true;
  const limit = FREE_LIMIT + (extension.data?.bonus ?? 0);

  const claim = useMutation({
    mutationFn: () => claimFn({ data: undefined } as any),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["trial-card-bonus"] }),
        qc.invalidateQueries({ queryKey: ["trial-status"] }),
      ]);
      setOpen(false);
      toast.success(T("Pronto! Você ganhou +5 dias de teste e pode criar mais 40 flashcards."));
    },
    onError: () => toast.error(T("Não foi possível conceder o prazo extra. Tente novamente.")),
  });

  return (
    <LimitCtx.Provider value={{ show }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
              <Sparkles className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">{T("Limite gratuito atingido")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground text-center">
            <p>{T("Você atingiu o limite de {n} flashcards do seu teste.", { n: limit })}</p>
            <p>{T("Assine o Pro para criar flashcards sem limite.")}</p>
            {!granted && (
              <p>{T("Precisa de mais tempo para decidir? Ganhe +5 dias de teste e mais 40 flashcards. Vale uma única vez.")}</p>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:justify-center">
            <Button asChild className="w-full" onClick={() => setOpen(false)}>
              <Link to="/store">{T("Assinar Plano Pro")}</Link>
            </Button>
            {!granted && (
              <Button
                variant="outline"
                className="w-full"
                disabled={claim.isPending}
                onClick={() => claim.mutate()}
              >
                {claim.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {T("Preciso de mais tempo (+5 dias e +40 cards)")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LimitCtx.Provider>
  );
}
