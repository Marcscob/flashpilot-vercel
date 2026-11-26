CREATE TABLE IF NOT EXISTS public.ai_fallback_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  feature text NOT NULL,
  failed_model text NOT NULL,
  fallback_model text,
  reason text
);
CREATE INDEX IF NOT EXISTS ai_fallback_log_created_idx ON public.ai_fallback_log (created_at DESC);
GRANT ALL ON public.ai_fallback_log TO service_role;
ALTER TABLE public.ai_fallback_log ENABLE ROW LEVEL SECURITY;
