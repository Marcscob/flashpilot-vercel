CREATE TABLE IF NOT EXISTS public.tts_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  lang text NOT NULL,
  voice text NOT NULL,
  storage_path text NOT NULL,
  mime text NOT NULL DEFAULT 'audio/wav',
  char_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  use_count integer NOT NULL DEFAULT 1,
  last_used_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tts_cache_lang_idx ON public.tts_cache (lang);
CREATE INDEX IF NOT EXISTS tts_cache_last_used_idx ON public.tts_cache (last_used_at);

GRANT SELECT, INSERT, UPDATE ON public.tts_cache TO authenticated;
GRANT ALL ON public.tts_cache TO service_role;

ALTER TABLE public.tts_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tts cache readable by signed in users"
  ON public.tts_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "tts cache insert by signed in users"
  ON public.tts_cache FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tts cache usage update by signed in users"
  ON public.tts_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_tts_cache_updated_at ON public.tts_cache;
CREATE TRIGGER update_tts_cache_updated_at
  BEFORE UPDATE ON public.tts_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();