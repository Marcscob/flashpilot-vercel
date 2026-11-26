CREATE TABLE public.document_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'processing',
  mode text NOT NULL DEFAULT 'total',
  total_parts integer NOT NULL DEFAULT 1,
  processed_parts integer NOT NULL DEFAULT 0,
  failed_parts integer NOT NULL DEFAULT 0,
  cards_count integer NOT NULL DEFAULT 0,
  result_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  dismissed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT document_jobs_status_check CHECK (status IN ('processing','completed','failed'))
);

CREATE INDEX document_jobs_user_status_idx ON public.document_jobs (user_id, status, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_jobs TO authenticated;
GRANT ALL ON public.document_jobs TO service_role;

ALTER TABLE public.document_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own document jobs"
ON public.document_jobs FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_document_jobs_updated_at
BEFORE UPDATE ON public.document_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();