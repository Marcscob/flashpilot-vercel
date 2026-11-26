CREATE TABLE IF NOT EXISTS public.blog_newsletter_publications (
  post_id uuid PRIMARY KEY REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  queued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_newsletter_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  subscriber_id uuid NOT NULL REFERENCES public.blog_subscribers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'cancelled')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS blog_newsletter_deliveries_pending_idx
  ON public.blog_newsletter_deliveries (next_attempt_at, created_at)
  WHERE status = 'pending';

ALTER TABLE public.blog_newsletter_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_newsletter_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.blog_newsletter_publications FROM anon, authenticated;
REVOKE ALL ON public.blog_newsletter_deliveries FROM anon, authenticated;
GRANT ALL ON public.blog_newsletter_publications TO service_role;
GRANT ALL ON public.blog_newsletter_deliveries TO service_role;

CREATE TRIGGER update_blog_newsletter_deliveries_updated_at
  BEFORE UPDATE ON public.blog_newsletter_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Existing published content is not a new newsletter announcement.
INSERT INTO public.blog_newsletter_publications (post_id, queued_at)
SELECT id, now()
FROM public.blog_posts
WHERE status = 'published'
   OR (status = 'scheduled' AND published_at IS NOT NULL AND published_at <= now())
ON CONFLICT (post_id) DO NOTHING;
