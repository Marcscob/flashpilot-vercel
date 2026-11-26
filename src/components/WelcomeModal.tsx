import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Coins,
  Brain,
  Sparkles,
  MessagesSquare,
  ShoppingBag,
  Loader2,
  Repeat,
  NotebookPen,
  CalendarClock,
  ShieldCheck,
  BookOpen,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { T } from "@/lib/i18n-ui";
import { useLang } from "@/lib/i18n";
import { welcomeLocale, welcomeDirection } from "@/lib/welcome-locale";
import { trialKitCopy, trialEndLabel } from "@/lib/email-templates/trial-kit-i18n";
import { getWelcomeModalState, dismissWelcomeModal } from "@/lib/welcome-modal.functions";

export function WelcomeModal() {
  const { lang: baseLang, extLang } = useLang();
  const getState = useServerFn(getWelcomeModalState);
  const dismissFn = useServerFn(dismissWelcomeModal);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const state = useQuery({
    queryKey: ["welcome-modal-state"],
    queryFn: () => getState({ data: undefined }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (state.data && !state.data.dismissed) setOpen(true);
  }, [state.data]);

  const dismiss = useMutation({
    mutationFn: () => dismissFn({ data: undefined }),
    onSuccess: () => {
      setOpen(false);
      qc.setQueryData(["welcome-modal-state"], { dismissed: true, trialEndsAt: null });
    },
    onError: () => setOpen(false),
  });

  // A tela aparece uma única vez: qualquer forma de fechar grava a dispensa no perfil.
  const closeAndDismiss = () => {
    setOpen(false);
    if (!dismiss.isPending) dismiss.mutate();
  };

  const lang = welcomeLocale(extLang ?? baseLang, typeof navigator === "undefined" ? [] : navigator.languages);
  const t = trialKitCopy(lang);
  const endsAt = state.data?.trialEndsAt ?? null;
  const icons = [Coins, Repeat, MessagesSquare, Brain, BookOpen, NotebookPen];

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : closeAndDismiss())}>
      <DialogContent dir={welcomeDirection(lang)} className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="items-center text-center">
          <BrandLogo className="mx-auto h-28 w-auto sm:h-32" />
          <DialogTitle className="font-serif text-2xl">
            {T("Bem-vindo(a) à comunidade FlashPilot!")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t.headline}</DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border bg-secondary/60 p-5 text-center shadow-md">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold tracking-widest text-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            {t.badge}
          </span>
          <p className="mt-3 font-serif text-xl leading-snug">{t.headline}</p>
          {endsAt && (
            <p className="mt-1 text-sm opacity-90">
              {t.endsOn.replace("{date}", trialEndLabel(lang, endsAt))}
            </p>
          )}
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-foreground">{t.listTitle}</p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {t.perks.map((p, i) => {
              const Icon = icons[i] ?? Sparkles;
              return (
                <li
                  key={p.title}
                  className="flex gap-3 rounded-xl border border-border bg-secondary/40 p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold leading-tight text-foreground">
                      {p.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{p.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex gap-3 rounded-xl border border-border p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{t.safeTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.safeText}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link to="/store" onClick={closeAndDismiss}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              {T("Ver planos e a Loja")}
            </Link>
          </Button>
          <Button variant="outline" className="flex-1" onClick={closeAndDismiss}>
            {T("Começar a estudar")}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
          <div className="flex gap-3 text-muted-foreground">
            <Link
              to="/termos"
              className="underline hover:text-foreground"
              onClick={closeAndDismiss}
            >
              {T("Termos de uso")}
            </Link>
            <Link
              to="/privacidade"
              className="underline hover:text-foreground"
              onClick={closeAndDismiss}
            >
              {T("Política de Privacidade")}
            </Link>
          </div>
          <Button
            type="button"
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
            variant="link"
            className="inline-flex items-center gap-1 text-muted-foreground underline hover:text-foreground disabled:opacity-60"
          >
            {dismiss.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {T("Não mostrar mais")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
