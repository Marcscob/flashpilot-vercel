ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS order_index integer;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS order_index integer;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY name) AS rn
  FROM public.subjects
)
UPDATE public.subjects s SET order_index = r.rn FROM ranked r WHERE s.id = r.id AND s.order_index IS NULL;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id, subject_id, COALESCE(parent_id::text,'root') ORDER BY name) AS rn
  FROM public.topics
)
UPDATE public.topics t SET order_index = r.rn FROM ranked r WHERE t.id = r.id AND t.order_index IS NULL;

CREATE INDEX IF NOT EXISTS subjects_order_idx ON public.subjects (user_id, order_index);
CREATE INDEX IF NOT EXISTS topics_order_idx ON public.topics (user_id, subject_id, parent_id, order_index);