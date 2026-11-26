import { createFileRoute } from "@tanstack/react-router";

const SITE_NAME = "FlashPilot";
const SITE_URL = "https://flashpilot.net";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Início/fim (UTC) do dia calendário em America/Sao_Paulo que corresponde a
 * "hoje - nDays" dias atrás, usado para casar com profiles.created_at. */
function spCalendarDayRangeUtc(nDaysAgo: number): { start: string; end: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const target = new Date(Date.now() - nDaysAgo * 24 * 60 * 60 * 1000);
  const [{ value: y }, , { value: m }, , { value: d }] = fmt.formatToParts(target);
  // Meia-noite em America/Sao_Paulo (UTC-3, sem horário de verão) equivale a 03:00 UTC.
  const start = `${y}-${m}-${d}T03:00:00.000Z`;
  const endDate = new Date(`${y}-${m}-${d}T03:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  return { start, end: endDate.toISOString() };
}

type NudgeStage = {
  day: number;
  sentAtColumn: "trial_day9_email_sent_at" | "trial_day14_email_sent_at";
  template: "trial-day9" | "trial-day14";
};

const STAGES: NudgeStage[] = [
  { day: 9, sentAtColumn: "trial_day9_email_sent_at", template: "trial-day9" },
  { day: 14, sentAtColumn: "trial_day14_email_sent_at", template: "trial-day14" },
];

export const Route = createFileRoute("/api/public/hooks/trial-nudge-daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Só o agendador autorizado dispara a régua: sem o segredo, nada é lido.
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

        const results: Array<{ stage: number; sent: boolean; error?: string }> = [];

        for (const stage of STAGES) {
          const { start, end } = spCalendarDayRangeUtc(stage.day);
          const { data: candidates, error: candidatesError } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .gte("created_at", start)
            .lt("created_at", end)
            .is(stage.sentAtColumn, null);
          if (candidatesError) {
            results.push({ stage: stage.day, sent: false, error: "candidate_query_failed" });
            continue;
          }
          const userIds = (candidates ?? []).map((row) => row.user_id as string);
          if (!userIds.length) continue;

          // Nunca envie para quem já é assinante, mesmo que tenha assinado
          // durante o próprio período de teste.
          const { data: activeSubs, error: subsError } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id")
            .in("user_id", userIds)
            .eq("environment", "live")
            .in("status", ["active", "trialing", "past_due", "canceled"])
            .lte("current_period_start", new Date().toISOString())
            .gt("current_period_end", new Date().toISOString());
          if (subsError) {
            results.push({ stage: stage.day, sent: false, error: "subscription_query_failed" });
            continue;
          }
          const subscribedIds = new Set((activeSubs ?? []).map((row) => row.user_id as string));

          for (const userId of userIds) {
            if (subscribedIds.has(userId)) continue;

            const { data: isManager } = await supabaseAdmin.rpc("is_app_manager_user", {
              p_user_id: userId,
            });
            if (isManager) continue;

            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
            const email = userData?.user?.email;
            if (userError || !email) {
              results.push({ stage: stage.day, sent: false, error: "recipient_unavailable" });
              continue;
            }

            try {
              const result = await sendTemplateEmail(stage.template, email, {
                templateData: { siteName: SITE_NAME, siteUrl: SITE_URL },
                idempotencyKey: `${stage.template}-${userId}`,
              });
              const nowIso = new Date().toISOString();
              await supabaseAdmin
                .from("profiles")
                .update(
                  stage.sentAtColumn === "trial_day9_email_sent_at"
                    ? { trial_day9_email_sent_at: nowIso }
                    : { trial_day14_email_sent_at: nowIso },
                )
                .eq("user_id", userId);
              results.push({ stage: stage.day, sent: result.sent });
            } catch (sendError) {
              console.error("Trial nudge email failed", {
                stage: stage.day,
                errorType: sendError instanceof Error ? sendError.name : typeof sendError,
              });
              results.push({
                stage: stage.day,
                sent: false,
                error: "email_send_failed",
              });
            }
          }
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
