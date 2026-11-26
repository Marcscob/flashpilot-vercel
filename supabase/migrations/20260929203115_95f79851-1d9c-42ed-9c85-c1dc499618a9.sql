-- Jobs are readable by their owner, but all creation and state changes must
-- pass through authenticated server functions.
ALTER TABLE public.document_jobs
  ADD COLUMN IF NOT EXISTS action_id text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');

CREATE UNIQUE INDEX IF NOT EXISTS document_jobs_user_action_id_idx
  ON public.document_jobs (user_id, action_id)
  WHERE action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_jobs_expiry_idx
  ON public.document_jobs (expires_at);

DROP POLICY IF EXISTS "Users manage their own document jobs" ON public.document_jobs;
CREATE POLICY "Users read their own document jobs"
  ON public.document_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.document_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_jobs TO authenticated;
GRANT ALL ON public.document_jobs TO service_role;