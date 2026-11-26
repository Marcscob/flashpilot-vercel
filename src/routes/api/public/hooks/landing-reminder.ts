import { createFileRoute } from "@tanstack/react-router";

const SITE_URL = "https://flashpilot.net";
const REMINDER_AFTER_MS = 2 * 24 * 3600 * 1000;
const REMINDER_WINDOW_MS = 30 * 24 * 3600 * 1000;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Reminds visitors who created flashcards on the landing but did not open the account within 2 days. */
export const Route = createFileRoute("/api/public/hooks/landing-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
        const { authEmailRedirectUrl } = await import("@/lib/welcome-locale");

        const now = Date.now();
        const { data: due, error } = await supabaseAdmin
          .from("landing_visitor_handoffs")
          .select("id, lang, created_at, visitor_id, landing_visitors(email)")
          .is("cards_saved_at", null)
          .is("reminder_sent_at", null)
          .lte("created_at", new Date(now - REMINDER_AFTER_MS).toISOString())
          .gte("created_at", new Date(now - REMINDER_WINDOW_MS).toISOString())
          .order("created_at", { ascending: true })
          .limit(100);
        if (error) return Response.json({ error: "query_failed" }, { status: 500 });

        let sent = 0;
        let skipped = 0;
        let failed = 0;
        for (const row of due ?? []) {
          const visitor = Array.isArray(row.landing_visitors)
            ? row.landing_visitors[0]
            : row.landing_visitors;
          const email = visitor?.email;
          if (!email) {
            skipped += 1;
            continue;
          }
          try {
            const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
              type: "magiclink",
              email,
              options: { redirectTo: authEmailRedirectUrl(SITE_URL, row.lang, true) },
            });
            const actionLink = link?.properties?.action_link;
            if (linkError || !actionLink) throw linkError ?? new Error("no_link");
            const signedInAt = link.user?.last_sign_in_at;
            const alreadyAccessed =
              !!signedInAt && Date.parse(signedInAt) > Date.parse(row.created_at);
            if (!alreadyAccessed) {
              await sendTemplateEmail("landing-reminder", email, {
                templateData: {
                  lang: row.lang,
                  magicLinkUrl: actionLink,
                  createdAt: row.created_at,
                },
                idempotencyKey: `landing-reminder-${row.id}`,
              });
              sent += 1;
            } else {
              skipped += 1;
            }
            await supabaseAdmin
              .from("landing_visitor_handoffs")
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq("id", row.id);
          } catch (sendError) {
            failed += 1;
            console.error("Landing reminder failed", {
              errorType: sendError instanceof Error ? sendError.name : typeof sendError,
            });
          }
        }
        return Response.json({ ok: true, sent, skipped, failed });
      },
    },
  },
});
