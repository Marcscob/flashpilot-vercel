CREATE TABLE IF NOT EXISTS public.translation_cache (
  cache_key text PRIMARY KEY,
  target_lang text NOT NULL DEFAULT 'pt-BR',
  source_lang text,
  translation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS translation_cache_last_hit_idx ON public.translation_cache (last_hit_at);
GRANT ALL ON public.translation_cache TO service_role;
ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;
