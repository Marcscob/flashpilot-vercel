ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS order_index INTEGER;

CREATE INDEX IF NOT EXISTS flashcards_topic_order_idx
  ON public.flashcards (topic_id, order_index NULLS LAST, created_at);

-- Backfill: extract first "Art. N" (or "Artigo N") from the answer
UPDATE public.flashcards
SET order_index = (substring(answer from '(?i)art(?:\.|igo)?\s*0*([0-9]+)'))::int
WHERE order_index IS NULL
  AND answer ~* 'art(\.|igo)?\s*[0-9]+';