CREATE TABLE IF NOT EXISTS public.ai_result_cache (
  cache_key text PRIMARY KEY,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ai_result_cache_kind_idx ON public.ai_result_cache (kind, last_hit_at);
GRANT ALL ON public.ai_result_cache TO service_role;
ALTER TABLE public.ai_result_cache ENABLE ROW LEVEL SECURITY;
