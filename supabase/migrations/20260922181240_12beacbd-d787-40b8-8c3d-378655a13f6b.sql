ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_country text,
  ADD COLUMN IF NOT EXISTS ui_lang text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_ui_lang_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ui_lang_check
  CHECK (ui_lang IS NULL OR ui_lang IN ('pt','pt-PT','es','en','fr','it','de'));