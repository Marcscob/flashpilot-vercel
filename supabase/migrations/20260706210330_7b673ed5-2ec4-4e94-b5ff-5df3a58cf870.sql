
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS telegram_link_code text,
  ADD COLUMN IF NOT EXISTS telegram_link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS user_settings_telegram_link_code_key
  ON public.user_settings (telegram_link_code)
  WHERE telegram_link_code IS NOT NULL;
