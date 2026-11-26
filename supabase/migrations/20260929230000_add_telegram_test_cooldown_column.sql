-- Guarda quando o usuário disparou o último teste de notificação do
-- Telegram, para permitir um cooldown de 60s no server e impedir rajadas
-- que consumiriam o limite de taxa da API do Telegram (recurso
-- compartilhado por todos os usuários do bot).
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS telegram_test_sent_at timestamptz;
