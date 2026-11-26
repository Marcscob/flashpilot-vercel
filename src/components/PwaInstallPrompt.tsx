import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { CheckCircle2, Download, EllipsisVertical, PlusSquare, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BrandLogo } from "@/components/BrandLogo";
import { useLang, useOverlayD } from "@/lib/i18n";
import {
  INSTALL_DISMISSED_KEY,
  isDismissalActive,
  installCopy,
  installPlatform,
  shouldOfferInstall,
} from "@/lib/pwa-install";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const { pathname } = useLocation();
  const { lang, extLang } = useLang();
  const overlay = useOverlayD();
  const c = installCopy(extLang || lang, overlay ?? undefined);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  function dismiss() {
    setDismissed(true);
    setInstalled(false);
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      /* In-memory dismissal still works when storage is blocked. */
    }
  }

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateMode = () =>
      setStandalone(
        displayMode.matches ||
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      );
    updateMode();
    setPlatform(installPlatform(navigator.userAgent, navigator.maxTouchPoints));
    try {
      setDismissed(isDismissalActive(localStorage.getItem(INSTALL_DISMISSED_KEY)));
    } catch {
      setDismissed(false);
    }
    const beforeInstall = (event: Event) => {
      let deviceDismissed = false;
      try {
        deviceDismissed = isDismissalActive(localStorage.getItem(INSTALL_DISMISSED_KEY));
      } catch {
        /* Storage may be blocked. */
      }
      if (
        !shouldOfferInstall(
          window.location.pathname,
          installPlatform(navigator.userAgent, navigator.maxTouchPoints),
          displayMode.matches ||
            Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
          deviceDismissed,
        )
      )
        return;
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setInstalled(true);
      setDismissed(true);
      // No persistent flag: after uninstalling, the browser context must be able to offer installation again.
      try {
        localStorage.removeItem(INSTALL_DISMISSED_KEY);
      } catch {
        /* Optional device storage. */
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === INSTALL_DISMISSED_KEY && isDismissalActive(event.newValue))
        setDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("storage", onStorage);
    displayMode.addEventListener("change", updateMode);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("storage", onStorage);
      displayMode.removeEventListener("change", updateMode);
    };
  }, []);

  const open =
    !standalone && (installed || shouldOfferInstall(pathname, platform, standalone, dismissed));
  async function install() {
    if (!installEvent || busy) return;
    setBusy(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      if (choice.outcome === "dismissed") dismiss();
      // Only appinstalled confirms installation; accepting the prompt is not proof.
    } catch {
      setInstallEvent(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="max-w-sm rounded-lg [&>button:last-child]:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          aria-label={c.close}
          onClick={dismiss}
        >
          <X />
        </Button>
        <BrandLogo variant="symbol" />
        <DialogHeader>
          <DialogTitle className="text-xl leading-snug">{c.title}</DialogTitle>
          <DialogDescription>{installed ? c.success : c.body}</DialogDescription>
        </DialogHeader>
        {installed ? (
          <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden />
        ) : platform === "ios" ? (
          <ol className="space-y-4 text-sm">
            {[
              { Icon: Share, text: c.share },
              { Icon: PlusSquare, text: c.add },
              { Icon: CheckCircle2, text: c.confirm },
            ].map(({ Icon, text }, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <strong>{index + 1}.</strong> {text}
                </span>
              </li>
            ))}
          </ol>
        ) : installEvent ? (
          <Button onClick={() => void install()} disabled={busy}>
            <Download />
            {c.install}
          </Button>
        ) : (
          <div className="flex items-start gap-3 text-sm">
            <EllipsisVertical className="h-6 w-6 shrink-0 text-primary" />
            <p>{c.android}</p>
          </div>
        )}
        <Button variant="outline" onClick={dismiss}>
          {c.close}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
