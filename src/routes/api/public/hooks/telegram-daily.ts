import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { todayInSaoPaulo } from "@/lib/today";

const APP_URL = "https://flashpilot.lovable.app";

async function sendTelegram(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return (await res.json()) as { ok: boolean; description?: string };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/telegram-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Só o agendador autorizado dispara os lembretes: sem o segredo, nada é lido.
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          return Response.json({ error: "CRON_SECRET missing" }, { status: 500 });
        }
        const provided =
          request.headers.get("x-cron-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!safeEqual(provided, cronSecret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
          return Response.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


        const today = todayInSaoPaulo();

        const { data: users, error: usersErr } = await supabaseAdmin
          .from("user_settings")
          .select("user_id, telegram_chat_id")
          .eq("notifications_enabled", true)
          .eq("telegram_enabled", true)
          .not("telegram_chat_id", "is", null);

        if (usersErr) {
          return Response.json({ error: "users_query_failed" }, { status: 500 });
        }

        let sent = 0;
        let failed = 0;
        let skipped = 0;

        for (const u of users ?? []) {
          const chatId = u.telegram_chat_id;
          if (!chatId) continue;

          const cards: Array<{
            topics: { name: string; subjects: { name: string } | null } | null;
          }> = [];
          const PAGE = 1000;
          let from = 0;
          let dueErr: { message: string } | null = null;
          // Paginate past PostgREST's 1000-row cap so counts stay accurate.
          while (true) {
            const { data: page, error } = await (supabaseAdmin as ReturnType<typeof createClient>)
              .from("flashcards")
              .select("id, topics!inner(name, review_enabled, subjects(name))")
              .eq("user_id", u.user_id)
              .lte("due_date", today)
              .eq("topics.review_enabled", true)
              .range(from, from + PAGE - 1);
            if (error) { dueErr = error; break; }
            const rows = (page ?? []) as typeof cards;
            cards.push(...rows);
            if (rows.length < PAGE) break;
            from += PAGE;
          }

          if (dueErr) {
            failed++;
            continue;
          }
          if (cards.length === 0) {
            skipped++;
            continue;
          }

          const byTopic = new Map<string, number>();
          for (const c of cards) {
            const t = c.topics?.name ?? "Sem tópico";
            const s = c.topics?.subjects?.name ?? "";
            const key = s ? `${s} › ${t}` : t;
            byTopic.set(key, (byTopic.get(key) ?? 0) + 1);
          }

          const lines = Array.from(byTopic.entries())
            .map(([k, n]) => `• <b>${k}</b> — ${n} card${n > 1 ? "s" : ""}`)
            .join("\n");

          const text = `📚 <b>Revisão de hoje</b>\n\nVocê tem <b>${cards.length}</b> flashcard${cards.length > 1 ? "s" : ""} para revisar:\n\n${lines}\n\n<a href="${APP_URL}">Abrir app e revisar agora</a> ✨`;

          const r = await sendTelegram(token, chatId, text);
          if (r.ok) sent++;
          else failed++;
        }

        return Response.json({ ok: true, processed: sent + failed + skipped, sent, failed, skipped });
      },
    },
  },
});
