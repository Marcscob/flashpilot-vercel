import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { recordCookieConsent } from "@/lib/profile.functions";
import { useT } from "@/lib/i18n";

const STORAGE_KEY = "fp_cookies_accepted_at";

export function CookieBanner() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* armazenamento indisponível: não mostra o aviso */
    }
  }, []);

  async function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* ignora */
    }
    setVisible(false);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      try {
        await recordCookieConsent({ data: undefined });
      } catch (error) {
        console.error("Failed to record cookie consent", error);
      }
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center">
        <Cookie className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
          {t.cookies.text}{" "}
          <Link to="/privacidade" className="underline">{t.cookies.privacyLink}</Link>.
        </p>
        <Button size="sm" onClick={accept} className="shrink-0">
          {t.cookies.accept}
        </Button>
      </div>
    </div>
  );
}
