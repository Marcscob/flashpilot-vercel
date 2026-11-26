CREATE OR REPLACE FUNCTION public.delete_expired_document_jobs()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  UPDATE public.ai_flashcoin_holds
  SET amount = 0, status = 'released', settled_at = now()
  WHERE status = 'reserved'
    AND expires_at <= now();

  DELETE FROM public.ai_generated_flashcard_outputs
  WHERE created_at < now() - interval '90 days';

  WITH expired_jobs AS (
    SELECT job.id
    FROM public.document_jobs AS job
    WHERE job.expires_at <= clock_timestamp()
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_budget_reservations AS reservation
        WHERE reservation.user_id = job.user_id
          AND reservation.action_id = job.action_id
          AND reservation.status IN ('reserved', 'uncertain')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_generation_leases AS lease
        JOIN public.ai_quota_reservations AS reservation
          ON reservation.user_id = lease.user_id
         AND reservation.action_id = lease.action_id
        WHERE reservation.user_id = job.user_id
          AND reservation.job_id = job.id
          AND reservation.resource = 'flashcards_job'
          AND lease.lease_expires_at > clock_timestamp()
      )
    ORDER BY job.expires_at, job.id
    FOR UPDATE OF job SKIP LOCKED
  )
  DELETE FROM public.document_jobs AS job
  USING expired_jobs
  WHERE job.id = expired_jobs.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_expired_document_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_document_jobs() TO service_role;

CREATE OR REPLACE FUNCTION public.discard_ai_generated_flashcard_job(
  p_user_id uuid,
  p_job_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_job_id IS NULL THEN
    RAISE EXCEPTION 'Invalid document job discard request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  SELECT id INTO v_job_id
  FROM public.document_jobs
  WHERE id = p_job_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document job not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Document job not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_generation_leases AS lease
    JOIN public.ai_quota_reservations AS reservation
      ON reservation.user_id = lease.user_id
     AND reservation.action_id = lease.action_id
    WHERE reservation.user_id = p_user_id
      AND reservation.job_id = p_job_id
      AND reservation.resource = 'flashcards_job'
      AND lease.lease_expires_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'Document job has an active generation; retry discard after it stops'
      USING ERRCODE = '55P03';
  END IF;

  DELETE FROM public.ai_generated_flashcard_outputs
  WHERE user_id = p_user_id
    AND job_id = p_job_id
    AND saved_action_id IS NULL;

  UPDATE public.ai_flashcoin_holds
  SET amount = 0,
      status = 'released',
      settled_at = now()
  WHERE user_id = p_user_id
    AND job_id = p_job_id
    AND status = 'reserved';

  UPDATE public.ai_quota_reservations
  SET status = 'released',
      daily_counted = true,
      settled_at = now()
  WHERE user_id = p_user_id
    AND job_id = p_job_id
    AND resource = 'flashcards_job'
    AND status = 'reserved';

  UPDATE public.document_jobs
  SET dismissed = true,
      input_slices = '[]'::jsonb,
      input_images = '[]'::jsonb,
      result_cards = '[]'::jsonb,
      cards_count = 0,
      error_message = NULL,
      updated_at = now()
  WHERE id = p_job_id
    AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.discard_ai_generated_flashcard_job(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discard_ai_generated_flashcard_job(uuid, uuid)
  TO service_role;