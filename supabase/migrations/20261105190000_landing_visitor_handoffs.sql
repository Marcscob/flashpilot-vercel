CREATE TABLE IF NOT EXISTS public.landing_visitor_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.landing_visitors(id) ON DELETE CASCADE,
  test_id uuid NOT NULL UNIQUE,
  lang text NOT NULL DEFAULT 'en',
  subject text,
  topic text,
  source_text text NOT NULL DEFAULT '',
  want_note boolean NOT NULL DEFAULT false,
  want_map boolean NOT NULL DEFAULT false,
  want_video boolean NOT NULL DEFAULT false,
  user_id uuid,
  topic_id uuid,
  cards_saved_at timestamptz,
  materials_done_at timestamptz,
  materials_attempts integer NOT NULL DEFAULT 0,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS landing_visitor_handoffs_visitor_idx
  ON public.landing_visitor_handoffs(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS landing_visitor_handoffs_reminder_idx
  ON public.landing_visitor_handoffs(created_at) WHERE cards_saved_at IS NULL AND reminder_sent_at IS NULL;
GRANT ALL ON public.landing_visitor_handoffs TO service_role;
ALTER TABLE public.landing_visitor_handoffs ENABLE ROW LEVEL SECURITY;
