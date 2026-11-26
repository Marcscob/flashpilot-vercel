-- Trial period gating: 15 days from account creation (profiles.created_at),
-- with an optional one-time +5 day gift (trial_extension_granted_at).
-- Subscribers (any environment) and the app manager are always exempt.
-- Blocks AI usage (via reserve_ai_quota / reserve_ai_generated_flashcard_billing)
-- and manual content creation (flashcards, notes, subjects, topics) once the
-- trial window has elapsed without an active subscription.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_extension_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_blocked_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_user_trial_blocked(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_trial_days integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(public.is_app_manager_user(p_user_id), false) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscriptions sub
    WHERE sub.user_id = p_user_id
      AND sub.status IN ('active', 'trialing', 'past_due', 'canceled')
      AND sub.current_period_start <= now()
      AND sub.current_period_end > now()
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_trial_days := CASE WHEN v_profile.trial_extension_granted_at IS NOT NULL THEN 20 ELSE 15 END;
  RETURN now() >= v_profile.created_at + make_interval(days => v_trial_days);
END;
$$;

REVOKE ALL ON FUNCTION public.is_user_trial_blocked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_trial_blocked(uuid) TO service_role;

-- Returns the resolved trial status for the signed-in user, used by the app
-- to render the end-of-trial screen and the +5 day gift offer.
CREATE OR REPLACE FUNCTION public.get_trial_status(p_user_id uuid)
RETURNS TABLE (
  blocked boolean,
  trial_ends_at timestamptz,
  extension_granted boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_trial_days integer;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    blocked := false;
    trial_ends_at := NULL;
    extension_granted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  v_trial_days := CASE WHEN v_profile.trial_extension_granted_at IS NOT NULL THEN 20 ELSE 15 END;
  blocked := public.is_user_trial_blocked(p_user_id);
  trial_ends_at := v_profile.created_at + make_interval(days => v_trial_days);
  extension_granted := v_profile.trial_extension_granted_at IS NOT NULL;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trial_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_status(uuid) TO service_role;

-- One-time +5 day gift. Idempotent: a second call is a no-op.
CREATE OR REPLACE FUNCTION public.grant_trial_extension(p_user_id uuid)
RETURNS TABLE (
  trial_ends_at timestamptz,
  extension_granted boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid user' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 3));

  UPDATE public.profiles
  SET trial_extension_granted_at = now()
  WHERE user_id = p_user_id
    AND trial_extension_granted_at IS NULL;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  trial_ends_at := v_profile.created_at + make_interval(days => 20);
  extension_granted := true;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_trial_extension(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_trial_extension(uuid) TO service_role;

-- Block manual (non-AI) content creation once the trial has expired without
-- an active subscription. Reading/reviewing existing content is never blocked
-- because these triggers only fire on INSERT.
CREATE OR REPLACE FUNCTION public.block_content_creation_when_trial_expired()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND public.is_user_trial_blocked(NEW.user_id) THEN
    RAISE EXCEPTION 'Trial expirado: assine o FlashPilot Pro para continuar criando conteudo'
      USING ERRCODE = 'P0003';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_flashcards_insert_after_trial ON public.flashcards;
CREATE TRIGGER block_flashcards_insert_after_trial
  BEFORE INSERT ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.block_content_creation_when_trial_expired();

DROP TRIGGER IF EXISTS block_notes_insert_after_trial ON public.notes;
CREATE TRIGGER block_notes_insert_after_trial
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.block_content_creation_when_trial_expired();

DROP TRIGGER IF EXISTS block_subjects_insert_after_trial ON public.subjects;
CREATE TRIGGER block_subjects_insert_after_trial
  BEFORE INSERT ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.block_content_creation_when_trial_expired();

DROP TRIGGER IF EXISTS block_topics_insert_after_trial ON public.topics;
CREATE TRIGGER block_topics_insert_after_trial
  BEFORE INSERT ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.block_content_creation_when_trial_expired();

-- Guard the two AI billing entry points so generation stops before any
-- quota/FlashCoin reservation or provider call when the trial is over.

ALTER FUNCTION public.reserve_ai_quota_included_only(uuid, uuid, uuid, text, bigint, text)
  RENAME TO reserve_ai_quota_included_only_v1;

CREATE OR REPLACE FUNCTION public.reserve_ai_quota_included_only(
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
BEGIN
  IF public.is_user_trial_blocked(p_user_id) THEN
    RAISE EXCEPTION 'Trial expirado: assine o FlashPilot Pro para continuar usando a IA'
      USING ERRCODE = 'P0003';
  END IF;
  RETURN QUERY
  SELECT * FROM public.reserve_ai_quota_included_only_v1(
    p_user_id, p_action_id, p_job_id, p_resource, p_units, p_environment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_quota_included_only(uuid, uuid, uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota_included_only(uuid, uuid, uuid, text, bigint, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_generated_flashcard_billing(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid,
  p_requested_units integer,
  p_environment text
)
RETURNS TABLE (
  billing_reservation_id uuid,
  hold_id uuid,
  included_units integer,
  coins_reserved integer,
  available_after numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.ai_generated_flashcard_billing_reservations%ROWTYPE;
  v_job public.document_jobs%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_cost integer;
  v_is_manager boolean;
  v_is_pro boolean := false;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_used bigint := 0;
  v_included integer := 0;
  v_coins integer;
  v_held numeric := 0;
  v_reserved_units bigint := 0;
  v_quota_reservation_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL OR p_job_id IS NULL
     OR p_requested_units IS NULL OR p_requested_units < 1
     OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Invalid generated flashcard billing reservation'
      USING ERRCODE = '22023';
  END IF;

  IF public.is_user_trial_blocked(p_user_id) THEN
    RAISE EXCEPTION 'Trial expirado: assine o FlashPilot Pro para continuar usando a IA'
      USING ERRCODE = 'P0003';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  SELECT * INTO v_existing
  FROM public.ai_generated_flashcard_billing_reservations reservation
  WHERE reservation.user_id = p_user_id
    AND reservation.action_id = p_action_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.job_id <> p_job_id
       OR v_existing.requested_units <> p_requested_units
       OR v_existing.status NOT IN ('reserved', 'uncertain') THEN
      RAISE EXCEPTION 'Generated flashcard billing action was already used'
        USING ERRCODE = '22023';
    END IF;
    billing_reservation_id := v_existing.id;
    included_units := v_existing.included_units;
    coins_reserved := v_existing.coin_units;
    SELECT hold.id INTO hold_id
    FROM public.ai_flashcoin_holds hold
    WHERE hold.user_id = p_user_id
      AND hold.action_id = p_action_id
      AND hold.resource = 'flashcards_saved'
      AND hold.status = 'reserved'
    LIMIT 1;
    available_after := public.get_available_flashcoins(p_user_id);
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT * INTO v_job
  FROM public.document_jobs job
  WHERE job.id = p_job_id
    AND job.user_id = p_user_id
    AND NOT job.dismissed
    AND job.expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document job was discarded or expired'
      USING ERRCODE = 'P0002';
  END IF;
  SELECT COALESCE(SUM(reservation.requested_units), 0) INTO v_reserved_units
  FROM public.ai_generated_flashcard_billing_reservations reservation
  WHERE reservation.user_id = p_user_id
    AND reservation.job_id = p_job_id
    AND reservation.status IN ('reserved', 'uncertain', 'settled');
  IF v_reserved_units + p_requested_units > v_job.requested_cards THEN
    RAISE EXCEPTION 'Requested flashcard count exceeds the document job reservation'
      USING ERRCODE = '22023';
  END IF;

  v_is_manager := COALESCE(public.is_app_manager_user(p_user_id), false);
  IF NOT v_is_manager THEN
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND environment = p_environment
      AND status IN ('active', 'trialing', 'past_due', 'canceled')
      AND current_period_start <= now()
      AND current_period_end > now()
    ORDER BY created_at DESC
    LIMIT 1;
    v_is_pro := FOUND;
  ELSE
    v_is_pro := true;
  END IF;

  IF p_requested_units > (CASE WHEN v_is_manager THEN 2500 WHEN v_is_pro THEN 150 ELSE 40 END) THEN
    RAISE EXCEPTION 'Requested flashcard count exceeds the plan limit'
      USING ERRCODE = '22023';
  END IF;

  IF v_is_manager THEN
    v_included := p_requested_units;
  ELSIF v_is_pro THEN
    IF v_subscription.current_period_start IS NULL OR v_subscription.current_period_end IS NULL THEN
      RAISE EXCEPTION 'Subscription billing cycle is not verified' USING ERRCODE = 'P0001';
    END IF;
    v_period_start := v_subscription.current_period_start;
    v_period_end := v_subscription.current_period_end;
    SELECT COALESCE(SUM(reservation.units), 0) INTO v_used
    FROM public.ai_quota_reservations reservation
    WHERE reservation.user_id = p_user_id
      AND reservation.resource = 'flashcards_saved'
      AND reservation.status IN ('reserved', 'consumed')
      AND reservation.period_start = v_period_start
      AND reservation.period_end = v_period_end;
    v_included := LEAST(p_requested_units, GREATEST(0, 2500 - v_used)::integer);
  END IF;
  v_coins := p_requested_units - v_included;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(SUM(hold.amount), 0) INTO v_held
  FROM public.ai_flashcoin_holds hold
  WHERE hold.user_id = p_user_id
    AND hold.status = 'reserved'
    AND hold.expires_at > now();

  SELECT coins_cost::integer INTO v_cost
  FROM public.ai_action_costs
  WHERE id = 'bulk'
    AND is_active
    AND coins_cost > 0
    AND coins_cost = trunc(coins_cost);
  IF v_coins > 0 AND v_cost IS NULL THEN
    RAISE EXCEPTION 'Flashcard price is unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF v_profile.flashcoins_balance - v_held < v_coins * COALESCE(v_cost, 0) THEN
    RAISE EXCEPTION 'Saldo insuficiente de FlashCoins para reservar estes flashcards'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_included > 0 AND NOT v_is_manager THEN
    INSERT INTO public.ai_quota_reservations (
      user_id, action_id, job_id, resource, units, period_start, period_end, status
    )
    VALUES (
      p_user_id, p_action_id, p_job_id, 'flashcards_saved', v_included,
      v_period_start, v_period_end, 'reserved'
    )
    RETURNING id INTO v_quota_reservation_id;
  END IF;

  INSERT INTO public.ai_generated_flashcard_billing_reservations (
    user_id, action_id, job_id, requested_units, included_units,
    coin_units, quota_reservation_id
  )
  VALUES (
    p_user_id, p_action_id, p_job_id, p_requested_units, v_included,
    v_coins, v_quota_reservation_id
  )
  RETURNING id INTO billing_reservation_id;

  IF v_coins > 0 THEN
    INSERT INTO public.ai_flashcoin_holds (
      user_id, action_id, job_id, resource, cost_id, amount, unit_cost,
      quota_reservation_id, status, expires_at
    )
    VALUES (
      p_user_id, p_action_id, p_job_id, 'flashcards_saved', 'bulk',
      v_coins * v_cost, v_cost, v_quota_reservation_id, 'reserved', v_job.expires_at
    )
    RETURNING id INTO hold_id;
  END IF;

  included_units := v_included;
  coins_reserved := v_coins * COALESCE(v_cost, 0);
  available_after := GREATEST(
    0,
    v_profile.flashcoins_balance - v_held - coins_reserved
  );
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_generated_flashcard_billing(uuid, uuid, uuid, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_generated_flashcard_billing(uuid, uuid, uuid, integer, text)
  TO service_role;