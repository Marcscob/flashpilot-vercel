ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS video_url_1 text,
  ADD COLUMN IF NOT EXISTS video_url_2 text;