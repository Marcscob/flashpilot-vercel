import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAppManagerIdentity } from "@/lib/app-manager";

const top = (m: Map<string, number>, n = 15) =>
  [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

/** Relatório de uso: páginas, posts do blog e cliques mais frequentes. */
export const adminAnalyticsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365) }).parse(d))
  .handler(async ({ context, data }) => {
    if (!isAppManagerIdentity(context.claims)) throw new Error("Área restrita ao AppManager.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("analytics_events").select("event_type, path, label, session_id, created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(50000);
    if (error) throw new Error(error.message);
    const pages = new Map<string, number>(), posts = new Map<string, number>(), clicks = new Map<string, number>();
    const sessions = new Set<string>();
    let views = 0, clickCount = 0;
    for (const r of rows ?? []) {
      if (r.session_id) sessions.add(r.session_id);
      if (r.event_type === "view") {
        views++;
        const path = r.path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id");
        pages.set(path, (pages.get(path) ?? 0) + 1);
        const m = r.path.match(/\/blog\/([^/?#]+)/);
        if (m) posts.set(decodeURIComponent(m[1]), (posts.get(decodeURIComponent(m[1])) ?? 0) + 1);
      } else {
        clickCount++;
        const k = `${r.label ?? "?"} · ${r.path}`;
        clicks.set(k, (clicks.get(k) ?? 0) + 1);
      }
    }
    return { views, clicks: clickCount, sessions: sessions.size, topPages: top(pages), topPosts: top(posts), topClicks: top(clicks, 20) };
  });
