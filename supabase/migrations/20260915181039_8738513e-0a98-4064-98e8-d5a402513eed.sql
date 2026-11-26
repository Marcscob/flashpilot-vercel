ALTER TABLE public.tts_cache
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'student';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tts_cache_origin_check'
  ) THEN
    ALTER TABLE public.tts_cache
      ADD CONSTRAINT tts_cache_origin_check
      CHECK (origin IN ('official', 'student', 'chat'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tts_cache_origin_last_used_idx
  ON public.tts_cache (origin, last_used_at);