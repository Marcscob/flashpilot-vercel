ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_marked_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS flashcards_user_reviewed_idx ON public.flashcards (user_id, reviewed);