import { createFileRoute } from "@tanstack/react-router";
import { T } from "@/lib/i18n-ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, MessageCircle, Send, Link as LinkIcon, Unlink, Copy, ExternalLink, Palette, CheckCircle2, Loader2, Smartphone, Monitor } from "lucide-react";
import QRCode from "qrcode";
import { sendTelegramTest, generateTelegramLinkCode, unlinkTelegram } from "@/lib/telegram.functions";
import { useT } from "@/lib/i18n";
import { useScreenT } from "@/lib/i18n-screens";
import { useTheme, THEME_OPTIONS, type AppTheme } from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações | FlashPilot" },
      { name: "description", content: "Personalize idioma, aparência e lembretes de estudo no FlashPilot." },
      { property: "og:title", content: "Configurações | FlashPilot" },
      { property: "og:description", content: "Personalize idioma, aparência e lembretes de estudo no FlashPilot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const testSend = useServerFn(sendTelegramTest);
  const genCode = useServerFn(generateTelegramLinkCode);
  const unlink = useServerFn(unlinkTelegram);
  const t = useT();
  const sc = useScreenT();
  const { theme, setTheme } = useTheme();

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      const { data } = await supabase.from("user_settings").select("*").eq("user_id", u.user.id).maybeSingle();
      return (
        data ?? {
          user_id: u.user.id,
          telegram_chat_id: null as string | null,
          telegram_link_code: null as string | null,
          telegram_link_expires_at: null as string | null,
          telegram_enabled: true,
          notifications_enabled: true,
        }
      );
    },
    // Poll while a link code is pending so the UI updates when the bot binds it.
    refetchInterval: (q) => {
      const d = q.state.data as { telegram_chat_id?: string | null; telegram_link_code?: string | null } | undefined;
      return d && !d.telegram_chat_id && d.telegram_link_code ? 3000 : false;
    },
  });

  const [notifOn, setNotifOn] = useState(true);
  const [tgOn, setTgOn] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pending, setPending] = useState<{ code: string; deepLink: string; expiresAt: string } | null>(null);
  const [deviceTab, setDeviceTab] = useState<"mobile" | "pc">("mobile");
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  // Default tab by device: phone users see phone steps, desktop users see the QR path.
  useEffect(() => {
    if (typeof navigator !== "undefined" && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
      setDeviceTab("pc");
    }
  }, []);

  // QR code for the deep link, so desktop users can scan it with the phone camera.
  useEffect(() => {
    let cancelled = false;
    if (!pending) {
      setQrUrl(null);
      return;
    }
    QRCode.toDataURL(pending.deepLink, { width: 288, margin: 1 })
      .then((url) => { if (!cancelled) setQrUrl(url); })
      .catch(() => { if (!cancelled) setQrUrl(null); });
    return () => { cancelled = true; };
  }, [pending]);

  useEffect(() => {
    if (settings.data) {
      setNotifOn(settings.data.notifications_enabled);
      const anyData = settings.data as { telegram_enabled?: boolean };
      setTgOn(anyData.telegram_enabled ?? true);
    }
  }, [settings.data]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) setPermission("unsupported");
    else setPermission(Notification.permission);
  }, []);

  // Clear pending code UI once linked
  const linkedChatId = (settings.data as { telegram_chat_id?: string | null } | undefined)?.telegram_chat_id ?? null;
  useEffect(() => {
    if (linkedChatId && pending) {
      setPending(null);
      toast.success(sc.settings.linkedSuccess);
    }
  }, [linkedChatId, pending, sc.settings.linkedSuccess]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error(t.common.notAuth);
      const { error } = await supabase.from("user_settings").upsert({
        user_id: u.user.id,
        notifications_enabled: notifOn,
        telegram_enabled: tgOn,
        theme,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.settings.saved);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t.common.error),
  });

  const generate = useMutation({
    mutationFn: async () => genCode(),
    onSuccess: (r) => {
      setPending({ code: r.code, deepLink: r.deepLink, expiresAt: r.expiresAt });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : T("Erro")),
  });

  const doUnlink = useMutation({
    mutationFn: async () => unlink(),
    onSuccess: () => {
      setPending(null);
      toast.success(sc.settings.unlinkedSuccess);
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : T("Erro")),
  });

  const minsLeft = useMemo(() => {
    if (!pending) return null;
    const ms = new Date(pending.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 60000));
  }, [pending]);

  async function askPermission() {
    if (permission === "unsupported") {
      toast.error(t.settings.unsupported);
      return;
    }
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success(t.home.notifEnabled);
    else toast.error(t.settings.permDenied);
  }

  const isLinked = !!linkedChatId;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-4xl font-serif">{t.settings.title}</h1>
        <p className="text-muted-foreground mt-1">{t.settings.subtitle}</p>
      </div>

      {/* Theme */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Palette className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl">{t.settings.theme}</h2>
            <p className="text-sm text-muted-foreground mb-3">{t.settings.themeLabel}</p>
            <div className="flex flex-wrap gap-2">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setTheme(o.value)}
                  className={`px-3 py-2 rounded-lg text-sm border transition ${
                    theme === o.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* In-app + browser */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl">{t.settings.browserNotif}</h2>
            <p className="text-sm text-muted-foreground">{t.settings.browserNotifDesc}</p>
            <div className="mt-3">
              {permission === "granted" ? (
                <span className="inline-flex items-center gap-2 text-sm text-success">
                  <span className="h-2 w-2 rounded-full bg-success" /> {t.settings.active}
                </span>
              ) : permission === "denied" ? (
                <span className="text-sm text-destructive">{t.settings.blocked}</span>
              ) : permission === "unsupported" ? (
                <span className="text-sm text-muted-foreground">{t.settings.unsupported}</span>
              ) : (
                <Button size="sm" onClick={askPermission}>{t.settings.enable}</Button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4 flex items-center justify-between">
          <div>
            <Label htmlFor="notif-toggle" className="text-base">{t.settings.panelTitle}</Label>
            <p className="text-sm text-muted-foreground">{t.settings.panelHint}</p>
          </div>
          <Switch id="notif-toggle" checked={notifOn} onCheckedChange={setNotifOn} />
        </div>

        <div className="border-t border-border pt-4 flex items-center justify-between">
          <div>
            <Label htmlFor="tg-toggle" className="text-base">{sc.settings.tgAlerts}</Label>
            <p className="text-sm text-muted-foreground">{T("Enviar lembretes de revisão no seu chat vinculado.")}</p>
          </div>
          <Switch id="tg-toggle" checked={tgOn} onCheckedChange={setTgOn} />
        </div>
      </Card>

      {/* Telegram linking */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl">{sc.settings.telegram}</h2>
            <p className="text-sm text-muted-foreground mb-3">
              {sc.settings.telegramDescription}
            </p>

            {isLinked ? (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 text-sm text-success">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {sc.settings.linked}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await testSend();
                        toast.success(sc.settings.testSent);
                      } catch (e) {
                        toast.error(e instanceof Error && e.message ? e.message : sc.settings.sendFailed);
                      }
                    }}
                  >
                    <Send className="h-4 w-4 mr-2" /> {sc.settings.testSend}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => doUnlink.mutate()}
                    disabled={doUnlink.isPending}
                  >
                    <Unlink className="h-4 w-4 mr-2" /> {sc.settings.unlink}
                  </Button>
                </div>
              </div>
            ) : pending ? (
              <div className="space-y-4">
                {deviceTab === "mobile" ? (
                  <div className="rounded-md border border-border p-4 space-y-3">
                    <Button type="button" asChild size="lg" className="w-full">
                      <a href={pending.deepLink} target="_blank" rel="noopener noreferrer">
                        <Smartphone className="h-5 w-5 mr-2" /> {sc.settings.openTelegram}
                      </a>
                    </Button>
                    <p className="text-sm">{sc.settings.mobileS3}</p>
                  </div>
                ) : (
                  <div className="rounded-md border border-border p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start">
                      {qrUrl && (
                        <img src={qrUrl} alt={sc.settings.pcS1} className="h-40 w-40 shrink-0 rounded-md border border-border bg-white p-1" />
                      )}
                      <div className="space-y-2 text-sm">
                        <p className="font-medium">{sc.settings.pcS1}</p>
                        <p className="text-muted-foreground">{sc.settings.mobileS3}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" asChild>
                        <a href={pending.deepLink} target="_blank" rel="noopener noreferrer">
                          <Monitor className="h-4 w-4 mr-2" /> {sc.settings.openTelegram}
                        </a>
                      </Button>
                      <Button type="button" variant="outline" asChild>
                        <a
                          href={(() => {
                            const u = new URL(pending.deepLink);
                            const tg = `tg://resolve?domain=${u.pathname.slice(1)}&start=${pending.code}`;
                            return `https://web.telegram.org/k/#?tgaddr=${encodeURIComponent(tg)}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" /> {sc.settings.openWeb}
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {sc.settings.noTyping}
                </p>

                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span>{sc.settings.waitingConfirmation}</span>
                </div>

                <details className="rounded-md border border-border">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{sc.settings.manualOption}</summary>
                  <div className="border-t border-border px-4 py-3">
                    <p className="text-sm text-muted-foreground">{sc.settings.manualHint}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="min-w-0 break-all font-mono text-lg">{pending.code}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={sc.settings.copyCode}
                        title={sc.settings.copyCode}
                        onClick={() => {
                          navigator.clipboard?.writeText(pending.code);
                          toast.success(sc.settings.codeCopied);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{sc.settings.validFor(minsLeft ?? 0)}</p>
                  </div>
                </details>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => generate.mutate()}
                    disabled={generate.isPending}
                  >
                    {sc.settings.connectBtn}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPending(null)}>
                    {sc.settings.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
                <LinkIcon className="h-4 w-4 mr-2" />
                {generate.isPending ? sc.settings.generating : sc.settings.connectBtn}
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t.common.saving : t.settings.saveChanges}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">{t.settings.footer}</p>
    </div>
  );
}
