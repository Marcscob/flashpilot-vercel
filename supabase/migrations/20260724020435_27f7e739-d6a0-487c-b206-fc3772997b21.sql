
CREATE TABLE public.flashcard_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id UUID NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  quality SMALLINT NOT NULL CHECK (quality >= 0 AND quality <= 5),
  previous_due_date DATE,
  next_due_date DATE,
  interval_days INTEGER,
  ease_factor NUMERIC,
  repetitions INTEGER,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX flashcard_reviews_user_reviewed_idx ON public.flashcard_reviews (user_id, reviewed_at DESC);
CREATE INDEX flashcard_reviews_flashcard_idx ON public.flashcard_reviews (flashcard_id, reviewed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcard_reviews TO authenticated;
GRANT ALL ON public.flashcard_reviews TO service_role;

ALTER TABLE public.flashcard_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own review history"
ON public.flashcard_reviews
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
