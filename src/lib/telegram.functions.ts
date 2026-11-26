import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_URL = "https://flashpilot.lovable.app";

async function telegramApi(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não configurado");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!data.ok) throw new Error(data.description || `Telegram ${method} falhou`);
  return data.result;
}

async function sendTelegram(chatId: string, text: string) {
  await telegramApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

let _botUsernameCache: string | null = null;
async function getBotUsername(): Promise<string> {
  if (_botUsernameCache) return _botUsernameCache;
  const me = (await telegramApi("getMe", {})) as { username?: string };
  if (!me?.username) throw new Error("Não foi possível obter o username do bot");
  _botUsernameCache = me.username;
  return me.username;
}

function makeCode(): string {
  // Código imprevisível: 12 caracteres sorteados por gerador criptográfico.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export const generateTelegramLinkCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const username = await getBotUsername();
    const code = makeCode();
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: userId,
        telegram_link_code: code,
        telegram_link_expires_at: expires,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    return {
      code,
      expiresAt: expires,
      botUsername: username,
      deepLink: `https://t.me/${username}?start=${code}`,
    };
  });

export const unlinkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_settings")
      .update({
        telegram_chat_id: null,
        telegram_link_code: null,
        telegram_link_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTelegramTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: settings, error } = await supabase
      .from("user_settings")
      .select("telegram_chat_id, telegram_test_sent_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const chatId = settings?.telegram_chat_id;
    if (!chatId) throw new Error("Vincule seu Telegram primeiro");

    // Cooldown de 60s: sem isso, o usuário pode chamar o endpoint em rajada e
    // gerar volume de mensagens que consome o limite de taxa da API do
    // Telegram (recurso compartilhado por todos os usuários do bot).
    const lastSentAt = settings?.telegram_test_sent_at ? new Date(settings.telegram_test_sent_at).getTime() : 0;
    const elapsed = Date.now() - lastSentAt;
    if (elapsed < 60_000) {
      throw new Error(`Aguarde ${Math.ceil((60_000 - elapsed) / 1000)}s antes de testar de novo.`);
    }

    await sendTelegram(
      chatId,
      `✅ <b>Teste do Flash Pilot</b>\n\nVocê está recebendo notificações neste chat.\n\n<a href="${APP_URL}">Abrir app</a>`,
    );
    await supabase
      .from("user_settings")
      .update({ telegram_test_sent_at: new Date().toISOString() })
      .eq("user_id", userId);
    return { ok: true };
  });
