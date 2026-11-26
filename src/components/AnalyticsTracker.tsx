import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Registra visualizações de página e cliques (botões/links) para o relatório do AppManager. */
export function AnalyticsTracker({ userId }: { userId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    let sid = sessionStorage.getItem("fp_sid");
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem("fp_sid", sid); }
    const lang = document.documentElement.lang?.slice(0, 12) || null;
    const send = (event_type: "view" | "click", label: string | null) => {
      void supabase.from("analytics_events").insert({
        event_type, path: location.pathname.slice(0, 300), label: label?.slice(0, 120) ?? null,
        lang, session_id: sid, user_id: userId,
      });
    };
    send("view", null);
    const unsub = router.subscribe("onResolved", (e) => {
      if (e.pathChanged) send("view", null);
    });
    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as HTMLElement | null)?.closest("a,button,[data-track]") as HTMLElement | null;
      if (!el) return;
      const label = el.dataset.track || el.getAttribute("aria-label") || el.textContent?.trim().replace(/\s+/g, " ") || el.getAttribute("href") || "";
      if (label) send("click", label);
    };
    document.addEventListener("click", onClick, true);
    return () => { unsub(); document.removeEventListener("click", onClick, true); };
  }, [router, userId]);

  return null;
}
