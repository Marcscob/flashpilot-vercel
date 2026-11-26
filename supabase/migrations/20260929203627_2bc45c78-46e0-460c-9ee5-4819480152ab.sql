CREATE TABLE IF NOT EXISTS public.ai_budget_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  attempt_id uuid NOT NULL,
  resource text NOT NULL,
  reserved_micros bigint NOT NULL CHECK (reserved_micros > 0),
  billed_micros bigint CHECK (billed_micros IS NULL OR billed_micros >= 0),
  rate_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved', 'uncertain', 'reconciled', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  UNIQUE (user_id, action_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS ai_budget_reservations_created_status_idx
  ON public.ai_budget_reservations (created_at, status);

ALTER TABLE public.ai_budget_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_budget_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_budget_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_budget(
  p_user_id uuid,
  p_action_id text,
  p_attempt_id uuid,
  p_resource text,
  p_reserved_micros bigint,
  p_rate_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.ai_budget_reservations%ROWTYPE;
  v_daily_limit bigint;
  v_monthly_limit bigint;
  v_budget_enabled boolean;
  v_daily_used bigint;
  v_monthly_used bigint;
  v_reservation_id uuid;
  v_now timestamptz := now();
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_start timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF p_user_id IS NULL OR NULLIF(BTRIM(p_action_id), '') IS NULL
     OR p_attempt_id IS NULL OR NULLIF(BTRIM(p_resource), '') IS NULL
     OR NULLIF(BTRIM(p_rate_version), '') IS NULL OR p_reserved_micros <= 0 THEN
    RAISE EXCEPTION 'Invalid AI budget reservation' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.ai_budget_reservations')::bigint);

  SELECT * INTO v_existing
  FROM public.ai_budget_reservations
  WHERE user_id = p_user_id AND action_id = p_action_id AND attempt_id = p_attempt_id;

  IF FOUND THEN
    IF v_existing.reserved_micros <> p_reserved_micros
       OR v_existing.resource <> p_resource
       OR v_existing.rate_version <> p_rate_version THEN
      RAISE EXCEPTION 'Idempotency key reused with different reservation data'
        USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.id;
  END IF;

  SELECT daily_limit_micros, monthly_limit_micros, enabled AND metering_ready
  INTO v_daily_limit, v_monthly_limit, v_budget_enabled
  FROM public.ai_budget_limits
  WHERE id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI budget limits are not configured' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_budget_enabled THEN
    RAISE EXCEPTION 'Free AI budget protection is not activated' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN status IN ('reserved', 'uncertain') THEN reserved_micros
         WHEN status = 'reconciled' THEN COALESCE(billed_micros, 0)
         ELSE 0 END
  ), 0)
  INTO v_daily_used
  FROM public.ai_budget_reservations
  WHERE (created_at >= v_day_start AND created_at < v_day_start + interval '1 day')
     OR status IN ('reserved', 'uncertain');

  SELECT COALESCE(SUM(
    CASE WHEN status IN ('reserved', 'uncertain') THEN reserved_micros
         WHEN status = 'reconciled' THEN COALESCE(billed_micros, 0)
         ELSE 0 END
  ), 0)
  INTO v_monthly_used
  FROM public.ai_budget_reservations
  WHERE (created_at >= v_month_start AND created_at < v_month_start + interval '1 month')
     OR status IN ('reserved', 'uncertain');

  IF v_daily_used + p_reserved_micros > v_daily_limit
     OR v_monthly_used + p_reserved_micros > v_monthly_limit THEN
    RAISE EXCEPTION 'AI budget exhausted' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_budget_reservations (
    user_id, action_id, attempt_id, resource, reserved_micros, rate_version, status, created_at
  )
  VALUES (
    p_user_id, p_action_id, p_attempt_id, p_resource, p_reserved_micros, p_rate_version, 'reserved', v_now
  )
  RETURNING id INTO v_reservation_id;

  INSERT INTO public.ai_usage_ledger (
    user_id, action_id, attempt_id, resource, reserved_micros, rate_version, status, created_at
  )
  VALUES (
    p_user_id, p_action_id, p_attempt_id, p_resource, p_reserved_micros, p_rate_version, 'reserved', v_now
  );

  RETURN v_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_budget(uuid, text, uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_budget(uuid, text, uuid, text, bigint, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_ai_budget(
  p_reservation_id uuid,
  p_status text,
  p_billed_micros bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_budget_reservations%ROWTYPE;
  v_billed_micros bigint;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('uncertain', 'reconciled', 'released')
     OR (p_status = 'reconciled' AND (p_billed_micros IS NULL OR p_billed_micros < 0))
     OR (p_status = 'released' AND COALESCE(p_billed_micros, 0) <> 0) THEN
    RAISE EXCEPTION 'Invalid AI budget reconciliation' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.ai_budget_reservations')::bigint);

  SELECT * INTO v_reservation
  FROM public.ai_budget_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI budget reservation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_reservation.status IN ('reconciled', 'released') THEN
    IF v_reservation.status <> p_status
       OR COALESCE(v_reservation.billed_micros, 0) <> COALESCE(p_billed_micros, 0) THEN
      RAISE EXCEPTION 'AI budget reservation already finalized differently'
        USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;

  v_billed_micros := CASE
    WHEN p_status = 'reconciled' THEN p_billed_micros
    WHEN p_status = 'released' THEN 0
    ELSE NULL
  END;

  UPDATE public.ai_budget_reservations
  SET status = p_status, billed_micros = v_billed_micros, reconciled_at = now()
  WHERE id = p_reservation_id;

  UPDATE public.ai_usage_ledger
  SET status = p_status, billed_micros = v_billed_micros, reconciled_at = now()
  WHERE user_id = v_reservation.user_id
    AND action_id = v_reservation.action_id
    AND attempt_id = v_reservation.attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_ai_budget(uuid, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_ai_budget(uuid, text, bigint)
  TO service_role;

DROP FUNCTION IF EXISTS public.grant_ai_welcome_kit(uuid, text);

CREATE OR REPLACE FUNCTION public.grant_ai_welcome_kit(
  p_user_id uuid,
  p_device_hash text,
  p_subnet_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_email_confirmed timestamptz;
  v_prior_device_grants bigint;
  v_prior_subnet_grants bigint;
BEGIN
  IF p_user_id IS NULL OR p_device_hash IS NULL
     OR p_device_hash !~ '^[a-f0-9]{64}$'
     OR p_subnet_hash IS NULL
     OR p_subnet_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid welcome grant request' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE((
    SELECT enabled AND metering_ready FROM public.ai_budget_limits WHERE id = 1
  ), false) THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_subnet_hash, 1));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_hash, 2));

  UPDATE public.ai_welcome_grants
  SET subnet_hash = NULL
  WHERE granted_at < now() - interval '24 hours'
    AND subnet_hash IS NOT NULL;

  UPDATE public.ai_welcome_grants
  SET device_hash = NULL
  WHERE granted_at < now() - interval '180 days'
    AND device_hash IS NOT NULL;

  SELECT email_confirmed_at INTO v_email_confirmed
  FROM auth.users
  WHERE id = p_user_id;
  IF NOT FOUND OR v_email_confirmed IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ai_welcome_grants WHERE user_id = p_user_id) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_prior_device_grants
  FROM public.ai_welcome_grants
  WHERE device_hash = p_device_hash
    AND granted_at >= now() - interval '180 days';
  IF v_prior_device_grants >= 2 THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_prior_subnet_grants
  FROM public.ai_welcome_grants
  WHERE subnet_hash = p_subnet_hash
    AND granted_at >= now() - interval '24 hours';
  -- Allow shared networks headroom while limiting bulk account creation.
  IF v_prior_subnet_grants >= 50 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ai_welcome_grants (user_id, device_hash, subnet_hash)
  VALUES (p_user_id, p_device_hash, p_subnet_hash);

  UPDATE public.profiles
  SET flashcoins_balance = flashcoins_balance + 40
  WHERE user_id = p_user_id;

  INSERT INTO public.flashcoin_ledger (
    user_id, amount, balance_after, reason, action_id
  )
  VALUES (
    p_user_id, 40, v_profile.flashcoins_balance + 40, 'welcome_kit',
    'welcome:' || p_user_id::text
  );

  INSERT INTO public.ai_trial_entitlements (
    user_id, maps_remaining, formats_remaining, chat_turns_remaining, granted_at
  )
  VALUES (p_user_id, 2, 3, 15, now())
  ON CONFLICT (user_id) DO UPDATE
  SET maps_remaining = 2,
      formats_remaining = 3,
      chat_turns_remaining = 15,
      granted_at = EXCLUDED.granted_at,
      updated_at = now()
  WHERE public.ai_trial_entitlements.granted_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ai_welcome_kit(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ai_welcome_kit(uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_quota(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid,
  p_resource text,
  p_units bigint,
  p_environment text
)
RETURNS TABLE (
  reservation_id uuid,
  is_pro boolean,
  period_start timestamptz,
  period_end timestamptz,
  remaining_units bigint,
  was_existing boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.ai_quota_reservations%ROWTYPE;
  v_entitlements public.ai_trial_entitlements%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_limit bigint := 0;
  v_used bigint := 0;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_balance integer;
  v_budget_enabled boolean;
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_is_pro boolean := false;
  v_is_app_manager boolean := false;
  v_retry_existing boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL OR p_job_id IS NULL
     OR p_units IS NULL OR p_units <= 0 OR p_resource IS NULL OR p_resource NOT IN (
       'flashcards_job', 'flashcards_saved', 'mindmap', 'note_format',
       'chat_turn', 'tts_standalone'
     ) OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Invalid AI quota reservation' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  SELECT public.is_app_manager_user(p_user_id) INTO v_is_app_manager;
  v_is_pro := COALESCE(v_is_app_manager, false);

  SELECT * INTO v_existing
  FROM public.ai_quota_reservations
  WHERE user_id = p_user_id AND action_id = p_action_id AND resource = p_resource;

  IF FOUND THEN
    IF v_existing.units <> p_units OR v_existing.job_id <> p_job_id THEN
      RAISE EXCEPTION 'AI quota action cannot be reused' USING ERRCODE = '22023';
    END IF;
    IF v_existing.status = 'released' THEN
      IF v_existing.daily_counted THEN
        RAISE EXCEPTION 'AI quota action cannot be retried after provider submission'
          USING ERRCODE = '22023';
      END IF;
      v_retry_existing := true;
    ELSE
      SELECT v_is_pro OR EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = p_user_id
          AND environment = p_environment
          AND current_period_start = v_existing.period_start
          AND current_period_end = v_existing.period_end
          AND current_period_end > now()
      ) INTO v_is_pro;
      v_limit := CASE p_resource
        WHEN 'flashcards_saved' THEN 2500
        WHEN 'mindmap' THEN 50
        WHEN 'note_format' THEN 60
        WHEN 'chat_turn' THEN 400
        WHEN 'tts_standalone' THEN 100000
        ELSE 0
      END;
      IF v_is_app_manager THEN
        remaining_units := 2147483647;
      ELSIF v_is_pro THEN
        SELECT COALESCE(SUM(units), 0) INTO v_used
        FROM public.ai_quota_reservations
        WHERE user_id = p_user_id AND resource = p_resource
          AND status IN ('reserved', 'consumed')
          AND period_start = v_existing.period_start
          AND period_end = v_existing.period_end;
        v_limit := CASE WHEN v_limit = 0 THEN v_used ELSE v_limit END;
        remaining_units := GREATEST(0, v_limit - v_used);
      ELSE
        SELECT * INTO v_entitlements FROM public.ai_trial_entitlements WHERE user_id = p_user_id;
        remaining_units := CASE p_resource
          WHEN 'mindmap' THEN COALESCE(v_entitlements.maps_remaining, 0)
          WHEN 'note_format' THEN COALESCE(v_entitlements.formats_remaining, 0)
          WHEN 'chat_turn' THEN COALESCE(v_entitlements.chat_turns_remaining, 0)
          ELSE 0
        END;
      END IF;
      reservation_id := v_existing.id;
      is_pro := v_is_pro;
      period_start := v_existing.period_start;
      period_end := v_existing.period_end;
      was_existing := true;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF NOT v_is_app_manager THEN
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND environment = p_environment
      AND (
        (status IN ('active', 'trialing', 'past_due') AND current_period_end > now())
        OR (status = 'canceled' AND current_period_end > now())
      )
    ORDER BY created_at DESC
    LIMIT 1;
    v_is_pro := FOUND;
  END IF;

  IF v_is_app_manager THEN
    v_period_start := now();
    v_period_end := now() + interval '100 years';
    v_limit := NULL;
    v_balance := 2147483647;
  ELSIF v_is_pro THEN
    IF v_sub.current_period_start IS NULL OR v_sub.current_period_end IS NULL
       OR v_sub.current_period_start > now() OR v_sub.current_period_end <= now() THEN
      RAISE EXCEPTION 'Subscription billing cycle is not verified' USING ERRCODE = 'P0001';
    END IF;
    v_period_start := v_sub.current_period_start;
    v_period_end := v_sub.current_period_end;
    v_limit := CASE p_resource
      WHEN 'flashcards_saved' THEN 2500
      WHEN 'mindmap' THEN 50
      WHEN 'note_format' THEN 60
      WHEN 'chat_turn' THEN 400
      WHEN 'tts_standalone' THEN 100000
      WHEN 'flashcards_job' THEN NULL
      ELSE NULL
    END;
    IF v_limit IS NULL AND p_resource <> 'flashcards_job' THEN
      RAISE EXCEPTION 'Resource is not available on Pro' USING ERRCODE = 'P0001';
    END IF;
    SELECT COALESCE(SUM(units), 0) INTO v_used
    FROM public.ai_quota_reservations
    WHERE user_id = p_user_id
      AND resource = p_resource
      AND status IN ('reserved', 'consumed')
      AND period_start = v_period_start
      AND period_end = v_period_end;
    IF v_limit IS NOT NULL AND v_used + p_units > v_limit THEN
      RAISE EXCEPTION 'Pro resource quota exhausted' USING ERRCODE = 'P0001';
    END IF;
    v_balance := CASE WHEN v_limit IS NULL THEN 0
      ELSE GREATEST(0, (v_limit - v_used - p_units)::integer) END;
  ELSE
    SELECT enabled AND metering_ready INTO v_budget_enabled
    FROM public.ai_budget_limits
    WHERE id = 1;
    IF NOT COALESCE(v_budget_enabled, false) THEN
      RAISE EXCEPTION 'Free AI budget protection is not activated' USING ERRCODE = 'P0001';
    END IF;

    v_period_start := v_day_start;
    v_period_end := v_day_start + interval '1 day';
    SELECT * INTO v_entitlements
    FROM public.ai_trial_entitlements
    WHERE user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND OR v_entitlements.granted_at IS NULL THEN
      RAISE EXCEPTION 'Free AI trial is not available' USING ERRCODE = 'P0001';
    END IF;

    IF p_resource IN ('flashcards_job', 'mindmap', 'note_format') THEN
      SELECT COUNT(DISTINCT job_id) INTO v_used
      FROM public.ai_quota_reservations
      WHERE user_id = p_user_id
        AND resource IN ('flashcards_job', 'mindmap', 'note_format')
        AND created_at >= v_day_start
        AND (daily_counted OR status IN ('reserved', 'consumed'));
      IF v_used >= 5 THEN
        RAISE EXCEPTION 'Daily free AI job quota exhausted' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    v_balance := CASE p_resource
      WHEN 'mindmap' THEN v_entitlements.maps_remaining
      WHEN 'note_format' THEN v_entitlements.formats_remaining
      WHEN 'chat_turn' THEN v_entitlements.chat_turns_remaining
      WHEN 'flashcards_job' THEN 5
      ELSE 0
    END;
    IF p_resource = 'tts_standalone' OR p_resource = 'flashcards_saved' THEN
      RAISE EXCEPTION 'Resource is not available on Free' USING ERRCODE = 'P0001';
    END IF;
    IF v_balance < p_units THEN
      RAISE EXCEPTION 'Free resource quota exhausted' USING ERRCODE = 'P0001';
    END IF;

    IF p_resource = 'mindmap' THEN
      UPDATE public.ai_trial_entitlements
      SET maps_remaining = maps_remaining - p_units::integer, updated_at = now()
      WHERE user_id = p_user_id;
    ELSIF p_resource = 'note_format' THEN
      UPDATE public.ai_trial_entitlements
      SET formats_remaining = formats_remaining - p_units::integer, updated_at = now()
      WHERE user_id = p_user_id;
    ELSIF p_resource = 'chat_turn' THEN
      UPDATE public.ai_trial_entitlements
      SET chat_turns_remaining = chat_turns_remaining - p_units::integer, updated_at = now()
      WHERE user_id = p_user_id;
    END IF;
    v_balance := v_balance - p_units::integer;
  END IF;

  IF v_retry_existing THEN
    UPDATE public.ai_quota_reservations
    SET period_start = v_period_start,
        period_end = v_period_end,
        status = 'reserved',
        daily_counted = false,
        created_at = now(),
        settled_at = NULL
    WHERE id = v_existing.id
    RETURNING id INTO reservation_id;
  ELSE
    INSERT INTO public.ai_quota_reservations (
      user_id, action_id, job_id, resource, units, period_start, period_end, status
    )
    VALUES (
      p_user_id, p_action_id, p_job_id, p_resource, p_units, v_period_start, v_period_end, 'reserved'
    )
    RETURNING id INTO reservation_id;
  END IF;

  is_pro := v_is_pro;
  period_start := v_period_start;
  period_end := v_period_end;
  remaining_units := v_balance;
  was_existing := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_quota(uuid, uuid, uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota(uuid, uuid, uuid, text, bigint, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.settle_ai_quota(
  p_reservation_id uuid,
  p_success boolean,
  p_was_sent boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.ai_quota_reservations')::bigint);
  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI quota reservation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_reservation.status <> 'reserved' THEN
    IF (p_success AND v_reservation.status = 'consumed')
       OR (NOT p_success AND v_reservation.status = 'released') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'AI quota reservation already settled differently'
      USING ERRCODE = '22023';
  END IF;

  IF p_success THEN
    UPDATE public.ai_quota_reservations
    SET status = 'consumed', daily_counted = true, settled_at = now()
    WHERE id = p_reservation_id;
  ELSE
    UPDATE public.ai_quota_reservations
    SET status = 'released', daily_counted = p_was_sent, settled_at = now()
    WHERE id = p_reservation_id;

    IF v_reservation.period_end = v_reservation.period_start + interval '1 day' THEN
      IF v_reservation.resource = 'mindmap' THEN
        UPDATE public.ai_trial_entitlements
        SET maps_remaining = maps_remaining + v_reservation.units::integer, updated_at = now()
        WHERE user_id = v_reservation.user_id;
      ELSIF v_reservation.resource = 'note_format' THEN
        UPDATE public.ai_trial_entitlements
        SET formats_remaining = formats_remaining + v_reservation.units::integer, updated_at = now()
        WHERE user_id = v_reservation.user_id;
      ELSIF v_reservation.resource = 'chat_turn' THEN
        UPDATE public.ai_trial_entitlements
        SET chat_turns_remaining = chat_turns_remaining + v_reservation.units::integer, updated_at = now()
        WHERE user_id = v_reservation.user_id;
      END IF;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ai_quota(uuid, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_quota(uuid, boolean, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_ai_generation_lease(
  p_user_id uuid,
  p_action_id uuid,
  p_lease_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
  v_job_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION 'Invalid AI generation lease' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND resource = 'flashcards_job';
  IF FOUND THEN
    IF v_reservation.status <> 'reserved' THEN
      RAISE EXCEPTION 'Document job generation reservation is no longer active'
        USING ERRCODE = '55P03';
    END IF;

    SELECT id INTO v_job_id
    FROM public.document_jobs
    WHERE id = v_reservation.job_id
      AND user_id = p_user_id
      AND dismissed = false
      AND expires_at > clock_timestamp()
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Document job was discarded or expired'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.ai_generation_leases (
    user_id, action_id, lease_id, lease_expires_at, updated_at
  )
  VALUES (
    p_user_id, p_action_id, p_lease_id, clock_timestamp() + interval '60 seconds', now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET action_id = EXCLUDED.action_id,
      lease_id = EXCLUDED.lease_id,
      lease_expires_at = EXCLUDED.lease_expires_at,
      updated_at = EXCLUDED.updated_at
  WHERE public.ai_generation_leases.lease_expires_at <= clock_timestamp()
     OR (
       public.ai_generation_leases.action_id = EXCLUDED.action_id
       AND public.ai_generation_leases.lease_id = EXCLUDED.lease_id
     );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Another AI operation is already active for this account'
      USING ERRCODE = '55P03';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_ai_generation_lease(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_ai_generation_lease(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.renew_ai_generation_lease(
  p_user_id uuid,
  p_action_id uuid,
  p_lease_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND resource = 'flashcards_job';
  IF FOUND THEN
    IF v_reservation.status <> 'reserved' THEN
      RAISE EXCEPTION 'Document job generation reservation is no longer active'
        USING ERRCODE = '55P03';
    END IF;

    SELECT id INTO v_job_id
    FROM public.document_jobs
    WHERE id = v_reservation.job_id
      AND user_id = p_user_id
      AND dismissed = false
      AND expires_at > clock_timestamp()
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Document job was discarded or expired'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE public.ai_generation_leases
  SET lease_expires_at = clock_timestamp() + interval '60 seconds',
      updated_at = now()
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND lease_id = p_lease_id
    AND lease_expires_at > clock_timestamp();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI generation lease expired or was replaced'
      USING ERRCODE = '55P03';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_ai_generation_lease(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_ai_generation_lease(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.release_ai_generation_lease(
  p_user_id uuid,
  p_action_id uuid,
  p_lease_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_generation_leases
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND lease_id = p_lease_id;
$$;

REVOKE ALL ON FUNCTION public.release_ai_generation_lease(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_ai_generation_lease(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.settle_ai_quota_for_generated_flashcards(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.ai_quota_reservations')::bigint);
  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND job_id = p_job_id
    AND resource = 'flashcards_job'
  FOR UPDATE;
  IF NOT FOUND OR v_reservation.status = 'released' THEN
    RAISE EXCEPTION 'Generated flashcard quota reservation is missing or released'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.settle_ai_quota(v_reservation.id, true, true);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ai_quota_for_generated_flashcards(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_quota_for_generated_flashcards(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.has_ai_quota_action(
  p_user_id uuid,
  p_action_id uuid,
  p_resource text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ai_quota_reservations
    WHERE user_id = p_user_id
      AND action_id = p_action_id
      AND resource = p_resource
      AND status = 'consumed'
  );
$$;

REVOKE ALL ON FUNCTION public.has_ai_quota_action(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_ai_quota_action(uuid, uuid, text)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_chat_tts_authorizations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  response_hash text NOT NULL CHECK (response_hash ~ '^[a-f0-9]{64}$'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_id)
);

ALTER TABLE public.ai_chat_tts_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_chat_tts_authorizations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_chat_tts_authorizations TO service_role;

CREATE OR REPLACE FUNCTION public.authorize_ai_chat_tts(
  p_user_id uuid,
  p_action_id uuid,
  p_response_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_hash text;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL
     OR p_response_hash IS NULL OR p_response_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid tutor TTS authorization' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_quota_reservations
    WHERE user_id = p_user_id
      AND action_id = p_action_id
      AND resource = 'chat_turn'
      AND status = 'consumed'
  ) THEN
    RAISE EXCEPTION 'Tutor turn was not consumed' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_chat_tts_authorizations (user_id, action_id, response_hash)
  VALUES (p_user_id, p_action_id, p_response_hash)
  ON CONFLICT (user_id, action_id) DO NOTHING;

  SELECT response_hash INTO v_existing_hash
  FROM public.ai_chat_tts_authorizations
  WHERE user_id = p_user_id AND action_id = p_action_id
  FOR UPDATE;

  IF v_existing_hash <> p_response_hash THEN
    RAISE EXCEPTION 'Tutor TTS response does not match the authorized turn'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_ai_chat_tts(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_ai_chat_tts(uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_chat_tts(
  p_user_id uuid,
  p_action_id uuid,
  p_response_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL
     OR p_response_hash IS NULL OR p_response_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid tutor TTS request' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_chat_tts_authorizations
  SET consumed_at = now()
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND response_hash = p_response_hash
    AND consumed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tutor TTS is unavailable or already used'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_chat_tts(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_chat_tts(uuid, uuid, text)
  TO service_role;