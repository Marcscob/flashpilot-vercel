CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  session_id text CHECK (char_length(session_id) <= 64),
  event_type text NOT NULL CHECK (event_type IN ('view','click')),
  path text NOT NULL CHECK (char_length(path) <= 300),
  label text CHECK (char_length(label) <= 120),
  lang text CHECK (char_length(lang) <= 12)
);
CREATE INDEX analytics_events_created_idx ON public.analytics_events (created_at DESC);
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can log events" ON public.analytics_events FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());