import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { setTrialChoicePending } from "@/lib/trial-choice-gate";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag, Gift, Loader2, Clock } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { T } from "@/lib/i18n-ui";
import { getTrialStatus, claimTrialExtension } from "@/lib/trial.functions";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Período de teste de 15 (ou 20, com o presente de +5) dias esgotado sem
 * assinatura ativa: bloqueia a criação de novo conteúdo, mas a leitura do que
 * já foi salvo continua liberada normalmente fora deste diálogo.
 */
export function TrialEndedDialog() {
  const { isActive: isSubscribed, loading: subLoading } = useSubscription();
  const getStatus = useServerFn(getTrialStatus);
  const claimFn = useServerFn(claimTrialExtension);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  // Uma vez que o usuário fecha o aviso, não forçamos a reabertura nesta
  // sessão apenas por causa de um refetch do mesmo status já visto.
  const [dismissed, setDismissed] = useState(false);

  const status = useQuery({
    queryKey: ["trial-status"],
    queryFn: () => getStatus({ data: undefined } as any),
    enabled: !subLoading && !isSubscribed,
    staleTime: 60 * 1000,
    retry: false,
  });

  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const emailChoice = typeof search.trial === "string" ? search.trial : null;

  // Choice from the last-day e-mail: apply it once, then drop the query param.
  const [emailHandled, setEmailHandled] = useState(false);
  useEffect(() => {
    if (!emailChoice || emailHandled || subLoading || !status.data) return;
    setEmailHandled(true);
    setDismissed(true);
    setOpen(false);
    if (emailChoice === "extend" && !status.data.extensionGranted && !isSubscribed) {
      claimGift.mutate(undefined, { onSettled: () => void navigate({ to: "/home", replace: true }) });
    } else if (emailChoice === "pro") {
      void navigate({ to: "/store", replace: true });
    } else {
      void navigate({ to: "/home", replace: true });
    }
  }, [emailChoice, emailHandled, subLoading, status.data, isSubscribed]);

  // Hold the password offer until the student has made a choice.
  const gatePending = !isSubscribed && !dismissed && (subLoading || status.isLoading || open || giftOpen || (!!emailChoice && !emailHandled));
  useEffect(() => { setTrialChoicePending(gatePending); }, [gatePending]);
  useEffect(() => () => setTrialChoicePending(false), []);

  const choose = (to: "/home" | "/store") => {
    setDismissed(true);
    setOpen(false);
    setGiftOpen(false);
    void navigate({ to });
  };

  useEffect(() => {
    if (!subLoading && !isSubscribed && status.data?.blocked && !dismissed) setOpen(true);
    if (isSubscribed || status.data?.blocked === false) setOpen(false);
  }, [status.data, isSubscribed, subLoading, dismissed]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setDismissed(true);
  };

  const claimGift = useMutation({
    mutationFn: () => claimFn({ data: undefined } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trial-status"] });
      qc.invalidateQueries({ queryKey: ["trial-card-bonus"] });
      setGiftOpen(false);
      setOpen(false);
      setDismissed(true);
      if (!emailChoice) void navigate({ to: "/home" });
    },
  });

  if (isSubscribed) return null;
  const extensionGranted = !!status.data?.extensionGranted;
  const noCoins = (status.data?.flashcoinsBalance ?? 0) <= 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-md"
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            handleOpenChange(false);
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            handleOpenChange(false);
          }}
        >
          <DialogHeader className="items-center text-center">
            <BrandLogo className="mx-auto h-16 w-auto" />
            <DialogTitle className="font-serif text-2xl">
              {T("Seu período de teste acabou")}
            </DialogTitle>
            <DialogDescription>
              {noCoins
                ? T("Seus 15 dias de teste acabaram e você já utilizou todas as suas 40 FlashCoins gratuitas.")
                : T("Você pode continuar revendo tudo o que já criou, mas para criar novos flashcards, notas, mapas mentais ou conversar com o PilotAI, assine o FlashPilot Pro.")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => choose("/store")}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              {T("Contratar Pro")}
            </Button>
            {!extensionGranted && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setGiftOpen(true)}
              >
                {T("Testar por mais 5 dias")}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => choose("/home")}
            >
              {T("Continuar estudando")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={giftOpen} onOpenChange={setGiftOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <Gift className="mx-auto h-10 w-10 text-accent" />
            <DialogTitle className="font-serif text-xl">
              {T("Testar por mais 5 dias")}
            </DialogTitle>
            <DialogDescription>
              {noCoins
                ? T("Para utilizar as funcionalidades do FlashPilot nesses 5 dias, você pode assinar o Pro (que já inclui 150 ou 300 moedas) ou adquirir um lote avulso na Loja.")
                : T("Uma única vez, você ganha mais 5 dias de teste para usar o saldo de FlashCoins que ainda tem. Depois disso, a assinatura Pro é necessária para criar novo conteúdo.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => claimGift.mutate()}
              disabled={claimGift.isPending}
            >
              {claimGift.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Clock className="mr-2 h-4 w-4" />
              )}
              {T("Ativar +5 dias")}
            </Button>
            {noCoins && (
              <>
                <Button variant="outline" className="w-full" onClick={() => choose("/store")}>
                  {T("Contratar Pro")}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => choose("/store")}>
                  {T("Ir para a Loja")}
                </Button>
              </>
            )}
            <Button variant="ghost" className="w-full" onClick={() => setGiftOpen(false)}>
              {T("Voltar")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
