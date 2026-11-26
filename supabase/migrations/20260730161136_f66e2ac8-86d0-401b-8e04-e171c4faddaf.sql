ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS question_original text,
  ADD COLUMN IF NOT EXISTS answer_original text,
  ADD COLUMN IF NOT EXISTS card_format text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS rewritten_at timestamptz;

CREATE INDEX IF NOT EXISTS flashcards_rewritten_at_idx ON public.flashcards (rewritten_at);