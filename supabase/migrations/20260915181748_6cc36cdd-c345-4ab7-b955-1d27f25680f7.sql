CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  chars integer NOT NULL DEFAULT 0,
  lang text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_kind_check CHECK (kind IN ('tts_cloud', 'chat'))
);

CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx ON public.ai_usage (user_id, created_at DESC);

GRANT SELECT, INSERT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own ai usage read" ON public.ai_usage;
CREATE POLICY "own ai usage read" ON public.ai_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own ai usage insert" ON public.ai_usage;
CREATE POLICY "own ai usage insert" ON public.ai_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);