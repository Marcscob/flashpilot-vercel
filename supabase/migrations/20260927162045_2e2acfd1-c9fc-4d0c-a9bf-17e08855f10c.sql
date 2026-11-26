ALTER TABLE public.document_jobs
  ADD COLUMN IF NOT EXISTS input_slices jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hint text,
  ADD COLUMN IF NOT EXISTS focus text;