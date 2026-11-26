import { isAppManagerIdentity } from "@/lib/app-manager";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getTrialStatus } from "@/lib/trial.functions";

const PATTERN = /NO_FLASHCOINS|cr[eé]ditos? (de IA|do PilotAI|Lovable AI|do Groq)? ?esgotados|sem FlashCoins|saldo insuficiente|insufficient (credits|flashcoins)|status 402|\(402\)/i;
const EVENT = "fp:no-flashcoins";

export function isNoCoinsError(msg: unknown): boolean {
  const s = typeof msg === "string" ? msg : msg instanceof Error ? msg.message : "";
  return PATTERN.test(s);
}

export function openNoCoinsDialog() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

// Intercepta toasts de erro em todo o app: falta de créditos vira o modal de compra.
let patched = false;
function patchToast() {
  if (patched) return;
  patched = true;
  const original = toast.error.bind(toast);
  (toast as { error: typeof toast.error }).error = ((message: unknown, data?: { description?: unknown }) => {
    if (isNoCoinsError(message) || isNoCoinsError(data?.description)) {
      openNoCoinsDialog();
      return "";
    }
    return original(message as never, data as never);
  }) as typeof toast.error;
}

type Copy = { title: (n: string) => string; trial: (d: number) => string; body: string; buy: string; later: string };
const COPY: Record<string, Copy> = {
  pt: { title: (n) => `Olá${n ? `, ${n}` : ""}! Suas FlashCoins gratuitas terminaram`, trial: (d) => `Você ainda tem ${d} ${d === 1 ? "dia" : "dias"} de teste. `, body: "Recarregue suas FlashCoins para continuar usando os recursos do PilotAI. O saldo é liberado assim que o pagamento é confirmado.", buy: "Comprar FlashCoins agora", later: "Agora não" },
  "pt-PT": { title: (n) => `Olá${n ? `, ${n}` : ""}! As suas FlashCoins gratuitas terminaram`, trial: (d) => `Ainda tem ${d} ${d === 1 ? "dia" : "dias"} de teste. `, body: "Carregue as suas FlashCoins para continuar a usar os recursos do PilotAI. O saldo fica disponível assim que o pagamento é confirmado.", buy: "Comprar FlashCoins agora", later: "Agora não" },
  en: { title: (n) => `Hi${n ? `, ${n}` : ""}! Your free FlashCoins have run out`, trial: (d) => `You still have ${d} ${d === 1 ? "day" : "days"} left in your trial. `, body: "Top up your FlashCoins to keep using the PilotAI features. Your balance is available as soon as payment is confirmed.", buy: "Buy FlashCoins now", later: "Not now" },
  es: { title: (n) => `¡Hola${n ? `, ${n}` : ""}! Tus FlashCoins gratuitas se agotaron`, trial: (d) => `Aún te ${d === 1 ? "queda 1 día" : `quedan ${d} días`} de prueba. `, body: "Recarga tus FlashCoins para seguir usando las funciones de PilotAI. El saldo se libera en cuanto se confirma el pago.", buy: "Comprar FlashCoins ahora", later: "Ahora no" },
  fr: { title: (n) => `Bonjour${n ? ` ${n}` : ""} ! Vos FlashCoins gratuits sont épuisés`, trial: (d) => `Il vous reste encore ${d} ${d === 1 ? "jour" : "jours"} d'essai. `, body: "Rechargez vos FlashCoins pour continuer à utiliser les fonctions de PilotAI. Le solde est disponible dès la confirmation du paiement.", buy: "Acheter des FlashCoins", later: "Plus tard" },
  it: { title: (n) => `Ciao${n ? `, ${n}` : ""}! I tuoi FlashCoins gratuiti sono finiti`, trial: (d) => `Hai ancora ${d} ${d === 1 ? "giorno" : "giorni"} di prova. `, body: "Ricarica i tuoi FlashCoins per continuare a usare le funzioni di PilotAI. Il saldo è disponibile appena il pagamento è confermato.", buy: "Acquista FlashCoins ora", later: "Non ora" },
  de: { title: (n) => `Hallo${n ? ` ${n}` : ""}! Deine kostenlosen FlashCoins sind aufgebraucht`, trial: (d) => `Du hast noch ${d} ${d === 1 ? "Tag" : "Tage"} Testzeit übrig. `, body: "Lade deine FlashCoins auf, um die Funktionen von PilotAI weiter zu nutzen. Das Guthaben ist verfügbar, sobald die Zahlung bestätigt ist.", buy: "Jetzt FlashCoins kaufen", later: "Jetzt nicht" },
};

export function NoCoinsDialog() {
  const [open, setOpen] = useState(false);
  const { lang } = useLang();
  const navigate = useNavigate();
  const c = COPY[lang] ?? COPY.en;
  const loadTrial = useServerFn(getTrialStatus);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        if (isAppManagerIdentity(u.user)) { if (alive) setOpen(false); return; }
        const { data: p } = await supabase.from("profiles").select("full_name").eq("user_id", u.user.id).maybeSingle();
        const first = (p?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
        if (alive) setName(first);
        const t = await loadTrial();
        if (alive && t.trialEndsAt && !t.blocked) {
          const d = Math.ceil((new Date(t.trialEndsAt).getTime() - Date.now()) / 86_400_000);
          setDays(d > 0 ? d : null);
        }
      } catch { /* mensagem genérica continua válida */ }
    })();
    return () => { alive = false; };
  }, [open, loadTrial]);

  useEffect(() => {
    patchToast();
    const onOpen = () => setOpen(true);
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isNoCoinsError(e.reason)) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener(EVENT, onOpen);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener(EVENT, onOpen);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Coins className="h-7 w-7" />
          </div>
          <DialogTitle>{c.title(name)}</DialogTitle>
          <DialogDescription>{days ? c.trial(days) : ""}{c.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={() => setOpen(false)}>{c.later}</Button>
          <Button onClick={() => { setOpen(false); navigate({ to: "/store" }); }}>
            <Coins className="mr-2 h-4 w-4" />{c.buy}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
