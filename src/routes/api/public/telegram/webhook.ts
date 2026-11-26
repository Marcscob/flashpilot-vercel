import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

const APP_URL = "https://flashpilot.lovable.app";

function deriveSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function sendMessage(token: string, chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return new Response("Bot not configured", { status: 500 });

        const expected = deriveSecret(token);
        const actual = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        const update = (await request.json().catch(() => null)) as {
          message?: {
            chat?: { id?: number };
            text?: string;
            from?: { id?: number };
          };
        } | null;

        const msg = update?.message;
        const chatId = msg?.chat?.id;
        const text = (msg?.text ?? "").trim();
        if (!chatId || !text) return Response.json({ ok: true, ignored: true });

        const startMatch = text.match(/^\/start(?:\s+(\S+))?/i);
        if (!startMatch) {
          await sendMessage(
            token,
            chatId,
            `Envie <code>/start SEU_CODIGO</code> para vincular sua conta do Flash Pilot.\n\n<a href="${APP_URL}">Gerar código</a>`,
          );
          return Response.json({ ok: true });
        }

        const code = startMatch[1]?.trim().toUpperCase();
        if (!code) {
          await sendMessage(
            token,
            chatId,
            `Abra o Flash Pilot em <b>Configurações → Telegram</b> e toque em <b>Gerar código de vinculação</b>.\n\n<a href="${APP_URL}">Abrir app</a>`,
          );
          return Response.json({ ok: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row } = await supabaseAdmin
          .from("user_settings")
          .select("user_id, telegram_link_expires_at")
          .eq("telegram_link_code", code)
          .maybeSingle();

        if (!row) {
          await sendMessage(token, chatId, "❌ Código inválido. Gere um novo no app.");
          return Response.json({ ok: true });
        }
        const exp = row.telegram_link_expires_at ? new Date(row.telegram_link_expires_at).getTime() : 0;
        if (!exp || exp < Date.now()) {
          await sendMessage(token, chatId, "⌛ Código expirado. Gere um novo no app.");
          return Response.json({ ok: true });
        }

        const { error: updErr } = await supabaseAdmin
          .from("user_settings")
          .update({
            telegram_chat_id: String(chatId),
            telegram_link_code: null,
            telegram_link_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", row.user_id);

        if (updErr) {
          await sendMessage(token, chatId, "❌ Erro ao vincular. Tente novamente.");
          return Response.json({ ok: false, error: updErr.message }, { status: 500 });
        }

        await sendMessage(
          token,
          chatId,
          `✅ <b>Conta vinculada!</b>\n\nVocê receberá aqui os lembretes de revisão do Flash Pilot.\n\n<a href="${APP_URL}">Abrir app</a>`,
        );
        return Response.json({ ok: true, linked: true });
      },
    },
  },
});
