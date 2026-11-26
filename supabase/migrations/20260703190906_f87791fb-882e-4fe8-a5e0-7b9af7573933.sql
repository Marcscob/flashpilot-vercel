ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS review_enabled boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_topics_user_review_enabled ON public.topics(user_id, review_enabled);