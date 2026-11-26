-- Charge FlashCoins only after the included AI quota for a resource is exhausted.
-- Existing Free generated-card holds remain in ai_flashcoin_holds.

UPDATE public.ai_action_costs
SET coins_cost = CASE id
  WHEN 'chat' THEN 2
  WHEN 'note_format' THEN 4
  WHEN 'mindmap' THEN 7
  WHEN 'bulk' THEN 1
  ELSE coins_cost
END,
updated_at = now()
WHERE id IN ('chat', 'note_format', 'mindmap', 'bulk');

ALTER TABLE public.ai_flashcoin_holds
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS resource text,
  ADD COLUMN IF NOT EXISTS cost_id text REFERENCES public.ai_action_costs(id),
  ADD COLUMN IF NOT EXISTS uncertain boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quota_reservation_id uuid REFERENCES public.ai_quota_reservations(id),
  ADD COLUMN IF NOT EXISTS unit_cost integer CHECK (unit_cost IS NULL OR unit_cost > 0);

ALTER TABLE public.ai_flashcoin_holds
  ADD CONSTRAINT ai_flashcoin_holds_resource_check
  CHECK (
    resource IS NULL
    OR resource IN ('mindmap', 'note_format', 'chat_turn', 'flashcards_saved')
  );

ALTER TABLE public.document_jobs
  ADD COLUMN IF NOT EXISTS requested_cards integer NOT NULL DEFAULT 10
  CHECK (requested_cards BETWEEN 1 AND 2500);

ALTER TABLE public.ai_generated_flashcard_outputs
  ADD COLUMN IF NOT EXISTS flashcoin_cost integer NOT NULL DEFAULT 0
  CHECK (flashcoin_cost >= 0);

UPDATE public.ai_flashcoin_holds
SET resource = 'flashcards_saved',
    cost_id = 'bulk',
    unit_cost = 1
WHERE resource IS NULL
  AND status = 'reserved'
  AND amount > 0;

UPDATE public.ai_generated_flashcard_outputs output
SET flashcoin_cost = hold.unit_cost
FROM public.ai_flashcoin_holds hold
WHERE hold.user_id = output.user_id
  AND hold.action_id = output.action_id
  AND hold.resource = 'flashcards_saved'
  AND hold.status = 'reserved'
  AND output.saved_action_id IS NULL;

UPDATE public.ai_flashcoin_holds
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.ai_flashcoin_holds
  ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_flashcoin_holds_id_idx
  ON public.ai_flashcoin_holds (id);
CREATE UNIQUE INDEX IF NOT EXISTS ai_flashcoin_holds_quota_reservation_idx
  ON public.ai_flashcoin_holds (quota_reservation_id)
  WHERE quota_reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_flashcoin_holds_user_resource_active_idx
  ON public.ai_flashcoin_holds (user_id, resource, expires_at)
  WHERE status = 'reserved';

CREATE TABLE IF NOT EXISTS public.ai_generated_flashcard_billing_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.document_jobs(id) ON DELETE CASCADE,
  requested_units integer NOT NULL CHECK (requested_units BETWEEN 1 AND 2500),
  included_units integer NOT NULL CHECK (included_units >= 0),
  coin_units integer NOT NULL CHECK (coin_units >= 0),
  generated_units integer,
  saved_included_units integer NOT NULL DEFAULT 0 CHECK (saved_included_units >= 0),
  saved_coin_units integer NOT NULL DEFAULT 0 CHECK (saved_coin_units >= 0),
  quota_reservation_id uuid REFERENCES public.ai_quota_reservations(id),
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'uncertain', 'settled', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  UNIQUE (user_id, action_id),
  CHECK (included_units + coin_units = requested_units)
);

ALTER TABLE public.ai_generated_flashcard_billing_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_generated_flashcard_billing_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_generated_flashcard_billing_reservations TO service_role;

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

CREATE OR REPLACE FUNCTION public.settle_ai_generated_flashcard_billing(
  p_user_id uuid,
  p_action_id uuid,
  p_uncertain boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing public.ai_generated_flashcard_billing_reservations%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));
  SELECT * INTO v_billing
  FROM public.ai_generated_flashcard_billing_reservations
  WHERE user_id = p_user_id AND action_id = p_action_id
  FOR UPDATE;
  IF NOT FOUND OR v_billing.status IN ('settled', 'released') THEN
    RETURN;
  END IF;

  IF p_uncertain THEN
    UPDATE public.ai_generated_flashcard_billing_reservations
    SET status = 'uncertain'
    WHERE id = v_billing.id;
    UPDATE public.ai_flashcoin_holds
    SET uncertain = true, expires_at = 'infinity', settled_at = NULL
    WHERE user_id = p_user_id
      AND action_id = p_action_id
      AND status = 'reserved';
  ELSE
    UPDATE public.ai_generated_flashcard_billing_reservations
    SET status = 'released', settled_at = now()
    WHERE id = v_billing.id;
    UPDATE public.ai_flashcoin_holds
    SET status = 'released', settled_at = now()
    WHERE user_id = p_user_id
      AND action_id = p_action_id
      AND status = 'reserved';
    UPDATE public.ai_quota_reservations
    SET status = 'released', daily_counted = false, settled_at = now()
    WHERE id = v_billing.quota_reservation_id
      AND status = 'reserved';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ai_generated_flashcard_billing(uuid, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_generated_flashcard_billing(uuid, uuid, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_available_flashcoins(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT profile.flashcoins_balance
      FROM public.profiles profile
      WHERE profile.user_id = p_user_id
    ), 0)
    - COALESCE((
      SELECT SUM(hold.amount)
      FROM public.ai_flashcoin_holds hold
      WHERE hold.user_id = p_user_id
        AND hold.status = 'reserved'
        AND hold.expires_at > now()
    ), 0),
    0
  );
$$;

REVOKE ALL ON FUNCTION public.get_available_flashcoins(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_flashcoins(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_feature_flashcoins(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid,
  p_resource text,
  p_cost_id text,
  p_environment text,
  p_units integer DEFAULT 1
)
RETURNS TABLE (
  hold_id uuid,
  quota_reservation_id uuid,
  is_pro boolean,
  coins_reserved integer,
  available_after numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_cost public.ai_action_costs%ROWTYPE;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_amount integer;
  v_balance numeric;
  v_held numeric;
  v_quota_reservation_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL OR p_job_id IS NULL
     OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live')
     OR p_units IS NULL OR p_units < 1
     OR p_resource IS NULL OR p_cost_id IS NULL
     OR NOT (
       (p_resource = 'mindmap' AND p_cost_id = 'mindmap')
       OR (p_resource = 'note_format' AND p_cost_id = 'note_format')
       OR (p_resource = 'chat_turn' AND p_cost_id = 'chat')
       OR (p_resource = 'flashcards_saved' AND p_cost_id = 'bulk')
     ) THEN
    RAISE EXCEPTION 'Invalid AI FlashCoin reservation' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  WITH expired_holds AS (
    UPDATE public.ai_flashcoin_holds
    SET status = 'released', settled_at = now()
    WHERE user_id = p_user_id
      AND status = 'reserved'
      AND NOT uncertain
      AND expires_at <= now()
    RETURNING quota_reservation_id
  )
  UPDATE public.ai_quota_reservations reservation
  SET status = 'released', daily_counted = false, settled_at = now()
  FROM expired_holds expired
  WHERE reservation.id = expired.quota_reservation_id
    AND reservation.status = 'reserved';

  IF EXISTS (
    SELECT 1 FROM public.ai_flashcoin_holds hold
    WHERE hold.user_id = p_user_id
      AND hold.action_id = p_action_id
      AND hold.resource = p_resource
  ) THEN
    RAISE EXCEPTION 'AI FlashCoin action was already reserved or settled'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_cost
  FROM public.ai_action_costs
  WHERE id = p_cost_id AND is_active;
  IF NOT FOUND OR v_cost.coins_cost <= 0
     OR v_cost.coins_cost <> trunc(v_cost.coins_cost)
     OR v_cost.coins_cost * p_units > 2147483647 THEN
    RAISE EXCEPTION 'AI FlashCoin price is unavailable'
      USING ERRCODE = 'P0001';
  END IF;
  v_amount := (v_cost.coins_cost * p_units)::integer;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;
  v_balance := v_profile.flashcoins_balance;

  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND environment = p_environment
    AND status IN ('active', 'trialing', 'past_due', 'canceled')
    AND current_period_start <= now()
    AND current_period_end > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_period_start := v_sub.current_period_start;
    v_period_end := v_sub.current_period_end;
  ELSE
    v_period_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_period_end := v_period_start + interval '1 day';
  END IF;

  SELECT COALESCE(SUM(hold.amount), 0) INTO v_held
  FROM public.ai_flashcoin_holds hold
  WHERE hold.user_id = p_user_id
    AND hold.status = 'reserved'
    AND hold.expires_at > now();

  IF v_balance - v_held < v_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente de FlashCoins'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_quota_reservations (
    user_id, action_id, job_id, resource, units,
    period_start, period_end, status
  )
  VALUES (
    p_user_id, p_action_id, p_job_id, p_resource, p_units,
    v_period_start, v_period_end, 'reserved'
  )
  RETURNING id INTO v_quota_reservation_id;

  INSERT INTO public.ai_flashcoin_holds (
    user_id, action_id, job_id, resource, cost_id, amount, unit_cost,
    quota_reservation_id, status, expires_at
  )
  VALUES (
    p_user_id, p_action_id, p_job_id, p_resource, p_cost_id, v_amount, v_cost.coins_cost::integer,
    v_quota_reservation_id, 'reserved',
    CASE
      WHEN p_resource = 'flashcards_saved' THEN (
        SELECT job.expires_at
        FROM public.document_jobs job
        WHERE job.id = p_job_id AND job.user_id = p_user_id
      )
      ELSE now() + interval '15 minutes'
    END
  )
  RETURNING id, ai_flashcoin_holds.quota_reservation_id
  INTO hold_id, quota_reservation_id;

  is_pro := COALESCE(public.is_app_manager_user(p_user_id), false)
    OR COALESCE(v_sub.user_id IS NOT NULL, false);
  coins_reserved := v_amount;
  available_after := GREATEST(0, v_balance - v_held - v_amount);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_feature_flashcoins(uuid, uuid, uuid, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_feature_flashcoins(uuid, uuid, uuid, text, text, text, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.settle_ai_feature_flashcoins(
  p_user_id uuid,
  p_hold_id uuid,
  p_success boolean,
  p_uncertain boolean DEFAULT false
)
RETURNS TABLE (
  charged_coins integer,
  balance_after numeric,
  available_after numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.ai_flashcoin_holds%ROWTYPE;
  v_balance numeric;
BEGIN
  IF p_user_id IS NULL OR p_hold_id IS NULL OR p_success IS NULL OR p_uncertain IS NULL THEN
    RAISE EXCEPTION 'Invalid AI FlashCoin settlement' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  SELECT * INTO v_hold
  FROM public.ai_flashcoin_holds
  WHERE id = p_hold_id
    AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI FlashCoin hold not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_hold.status = 'consumed' AND p_success THEN
    charged_coins := v_hold.amount;
    SELECT profile.flashcoins_balance INTO balance_after
    FROM public.profiles profile WHERE profile.user_id = v_hold.user_id;
    balance_after := COALESCE(balance_after, 0);
    available_after := public.get_available_flashcoins(v_hold.user_id);
    RETURN NEXT;
    RETURN;
  ELSIF v_hold.status = 'released' AND NOT p_success AND NOT p_uncertain THEN
    charged_coins := 0;
    SELECT profile.flashcoins_balance INTO balance_after
    FROM public.profiles profile WHERE profile.user_id = v_hold.user_id;
    balance_after := COALESCE(balance_after, 0);
    available_after := public.get_available_flashcoins(v_hold.user_id);
    RETURN NEXT;
    RETURN;
  ELSIF v_hold.status = 'reserved' AND v_hold.uncertain AND NOT p_success AND p_uncertain THEN
    charged_coins := 0;
    SELECT profile.flashcoins_balance INTO balance_after
    FROM public.profiles profile WHERE profile.user_id = v_hold.user_id;
    balance_after := COALESCE(balance_after, 0);
    available_after := public.get_available_flashcoins(v_hold.user_id);
    RETURN NEXT;
    RETURN;
  ELSIF v_hold.status <> 'reserved' OR v_hold.uncertain THEN
    RAISE EXCEPTION 'AI FlashCoin hold was already settled differently'
      USING ERRCODE = '22023';
  END IF;

  SELECT flashcoins_balance INTO v_balance
  FROM public.profiles
  WHERE user_id = v_hold.user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_success THEN
    IF v_balance < v_hold.amount THEN
      RAISE EXCEPTION 'FlashCoin balance is below its active hold'
        USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.profiles
    SET flashcoins_balance = flashcoins_balance - v_hold.amount
    WHERE user_id = v_hold.user_id
    RETURNING flashcoins_balance INTO v_balance;

    INSERT INTO public.flashcoin_ledger (
      user_id, amount, balance_after, reason, action_id
    )
    VALUES (
      v_hold.user_id,
      -v_hold.amount,
      v_balance,
      'ai_feature',
      'ai-feature:' || v_hold.cost_id || ':' || v_hold.id::text
    );

    UPDATE public.ai_flashcoin_holds
    SET status = 'consumed', settled_at = now()
    WHERE id = p_hold_id;
    UPDATE public.ai_quota_reservations
    SET status = 'consumed', daily_counted = true, settled_at = now()
    WHERE id = v_hold.quota_reservation_id;
    charged_coins := v_hold.amount;
  ELSIF p_uncertain THEN
    UPDATE public.ai_flashcoin_holds
    SET uncertain = true, expires_at = 'infinity', settled_at = NULL
    WHERE id = p_hold_id;
    UPDATE public.ai_quota_reservations
    SET status = 'released', daily_counted = true, settled_at = now()
    WHERE id = v_hold.quota_reservation_id;
    charged_coins := 0;
  ELSE
    UPDATE public.ai_flashcoin_holds
    SET status = 'released', settled_at = now()
    WHERE id = p_hold_id;
    UPDATE public.ai_quota_reservations
    SET status = 'released', daily_counted = false, settled_at = now()
    WHERE id = v_hold.quota_reservation_id;
    charged_coins := 0;
  END IF;

  balance_after := v_balance;
  available_after := public.get_available_flashcoins(v_hold.user_id);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ai_feature_flashcoins(uuid, uuid, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_feature_flashcoins(uuid, uuid, boolean, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.renew_ai_feature_coin_hold(
  p_user_id uuid,
  p_hold_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_flashcoin_holds
  SET expires_at = now() + interval '15 minutes'
  WHERE id = p_hold_id
    AND user_id = p_user_id
    AND status = 'reserved'
    AND NOT uncertain
    AND expires_at > now();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI FlashCoin hold is unavailable' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_ai_feature_coin_hold(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_ai_feature_coin_hold(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.has_active_ai_feature_coin_hold(
  p_user_id uuid,
  p_action_id uuid,
  p_resource text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hold.id
    FROM public.ai_flashcoin_holds hold
    WHERE hold.user_id = p_user_id
      AND hold.action_id = p_action_id
      AND hold.resource = p_resource
      AND hold.status = 'reserved'
      AND NOT hold.uncertain
      AND hold.expires_at > now()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.has_active_ai_feature_coin_hold(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_ai_feature_coin_hold(uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_ai_feature_coin_hold(
  p_hold_id uuid,
  p_charge boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.ai_flashcoin_holds%ROWTYPE;
  v_balance numeric;
  v_user_id uuid;
BEGIN
  IF p_hold_id IS NULL OR p_charge IS NULL THEN
    RAISE EXCEPTION 'Invalid AI FlashCoin reconciliation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_hold
  FROM public.ai_flashcoin_holds
  WHERE id = p_hold_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Uncertain AI FlashCoin hold not found' USING ERRCODE = 'P0002';
  END IF;

  v_user_id := v_hold.user_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 2));

  SELECT * INTO v_hold
  FROM public.ai_flashcoin_holds
  WHERE id = p_hold_id
  FOR UPDATE;
  IF NOT FOUND OR v_hold.status <> 'reserved' OR NOT v_hold.uncertain THEN
    RAISE EXCEPTION 'Uncertain AI FlashCoin hold not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_charge THEN
    UPDATE public.profiles
    SET flashcoins_balance = flashcoins_balance - v_hold.amount
    WHERE user_id = v_hold.user_id
      AND flashcoins_balance >= v_hold.amount
    RETURNING flashcoins_balance INTO v_balance;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FlashCoin balance is below its uncertain hold'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.flashcoin_ledger (
      user_id, amount, balance_after, reason, action_id
    )
    VALUES (
      v_hold.user_id, -v_hold.amount, v_balance, 'ai_feature',
      'ai-feature:' || v_hold.cost_id || ':' || v_hold.id::text
    );
    UPDATE public.ai_flashcoin_holds
    SET status = 'consumed', uncertain = false, settled_at = now()
    WHERE id = p_hold_id;
    UPDATE public.ai_quota_reservations
    SET status = 'consumed', daily_counted = true, settled_at = now()
    WHERE id = v_hold.quota_reservation_id;
  ELSE
    UPDATE public.ai_flashcoin_holds
    SET status = 'released', settled_at = now()
    WHERE id = p_hold_id;
    UPDATE public.ai_quota_reservations
    SET status = 'released', daily_counted = true, settled_at = now()
    WHERE id = v_hold.quota_reservation_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_ai_feature_coin_hold(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_ai_feature_coin_hold(uuid, boolean)
  TO service_role;

ALTER FUNCTION public.reserve_ai_quota(uuid, uuid, uuid, text, bigint, text)
  RENAME TO reserve_ai_quota_included_only;

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
  v_hold record;
BEGIN
  IF p_user_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));
    WITH expired_holds AS (
      UPDATE public.ai_flashcoin_holds
      SET status = 'released', settled_at = now()
      WHERE user_id = p_user_id
        AND status = 'reserved'
        AND NOT uncertain
        AND expires_at <= now()
      RETURNING quota_reservation_id
    )
    UPDATE public.ai_quota_reservations reservation
    SET status = 'released', daily_counted = false, settled_at = now()
    FROM expired_holds expired
    WHERE reservation.id = expired.quota_reservation_id
      AND reservation.status = 'reserved';
  END IF;

  RETURN QUERY
  SELECT * FROM public.reserve_ai_quota_included_only(
    p_user_id, p_action_id, p_job_id, p_resource, p_units, p_environment
  );
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  IF p_resource <> 'flashcards_saved'
     OR SQLERRM <> 'Pro resource quota exhausted' THEN
    RAISE;
  END IF;

  SELECT * INTO v_hold
  FROM public.reserve_ai_feature_flashcoins(
    p_user_id,
    p_action_id,
    p_job_id,
    'flashcards_saved',
    'bulk',
    p_environment,
    p_units::integer
  );

  SELECT v_hold.quota_reservation_id,
         v_hold.is_pro,
         reservation.period_start,
         reservation.period_end,
         0::bigint,
         false
  INTO reservation_id, is_pro, period_start, period_end, remaining_units, was_existing
  FROM public.ai_quota_reservations reservation
  WHERE reservation.id = v_hold.quota_reservation_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_quota(uuid, uuid, uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota(uuid, uuid, uuid, text, bigint, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.charge_pro_flashcard_coin_holds_before_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold public.ai_flashcoin_holds%ROWTYPE;
  v_billing public.ai_generated_flashcard_billing_reservations%ROWTYPE;
  v_cards integer;
  v_charge numeric;
  v_saved_included integer;
  v_saved_coins integer;
  v_balance numeric;
BEGIN
  FOR v_hold IN
    SELECT hold.*
    FROM public.ai_flashcoin_holds hold
    WHERE hold.user_id = NEW.user_id
      AND hold.resource = 'flashcards_saved'
      AND hold.status = 'reserved'
      AND NOT hold.uncertain
      AND hold.expires_at > now()
      AND EXISTS (
        SELECT 1
        FROM public.ai_generated_flashcard_outputs output
        WHERE output.user_id = NEW.user_id
          AND output.action_id = hold.action_id
          AND output.saved_action_id = NEW.action_id
      )
    ORDER BY hold.action_id
    FOR UPDATE
  LOOP
    SELECT COUNT(*)::integer, COALESCE(SUM(output.flashcoin_cost), 0)
    INTO v_cards, v_charge
    FROM public.ai_generated_flashcard_outputs output
    WHERE output.user_id = NEW.user_id
      AND output.action_id = v_hold.action_id
      AND output.saved_action_id = NEW.action_id;

    IF v_cards < 1 OR v_hold.unit_cost IS NULL THEN
      RAISE EXCEPTION 'Generated flashcard coin hold is insufficient'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_charge = 0 THEN
      CONTINUE;
    END IF;
    IF v_charge < 1 OR v_charge > v_hold.amount THEN
      RAISE EXCEPTION 'Generated flashcard coin hold is insufficient'
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.profiles
    SET flashcoins_balance = flashcoins_balance - v_charge
    WHERE user_id = NEW.user_id
      AND flashcoins_balance >= v_charge
    RETURNING flashcoins_balance INTO v_balance;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FlashCoin balance is insufficient for saved flashcards'
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.flashcoin_ledger (
      user_id, amount, balance_after, reason, action_id
    )
    VALUES (
      NEW.user_id,
      -v_charge,
      v_balance,
      'ai_flashcards',
      'flashcards-save:' || NEW.action_id::text || ':' || v_hold.action_id::text
    );

    UPDATE public.ai_flashcoin_holds
    SET amount = amount - v_charge,
        status = CASE WHEN amount = v_charge THEN 'consumed' ELSE 'reserved' END,
        settled_at = CASE WHEN amount = v_charge THEN now() ELSE NULL END
    WHERE id = v_hold.id;

  END LOOP;

  FOR v_billing IN
    SELECT billing.*
    FROM public.ai_generated_flashcard_billing_reservations billing
    WHERE billing.user_id = NEW.user_id
      AND billing.status = 'reserved'
      AND EXISTS (
        SELECT 1
        FROM public.ai_generated_flashcard_outputs output
        WHERE output.user_id = NEW.user_id
          AND output.action_id = billing.action_id
          AND output.saved_action_id = NEW.action_id
      )
    ORDER BY billing.action_id
    FOR UPDATE
  LOOP
    SELECT
      COUNT(*) FILTER (WHERE output.flashcoin_cost = 0)::integer,
      COUNT(*) FILTER (WHERE output.flashcoin_cost > 0)::integer
    INTO v_saved_included, v_saved_coins
    FROM public.ai_generated_flashcard_outputs output
    WHERE output.user_id = NEW.user_id
      AND output.action_id = v_billing.action_id
      AND output.saved_action_id = NEW.action_id;

    UPDATE public.ai_generated_flashcard_billing_reservations
    SET saved_included_units = saved_included_units + v_saved_included,
        saved_coin_units = saved_coin_units + v_saved_coins
    WHERE id = v_billing.id;

    IF NOT EXISTS (
      SELECT 1
      FROM public.ai_generated_flashcard_outputs output
      WHERE output.user_id = NEW.user_id
        AND output.action_id = v_billing.action_id
        AND output.saved_action_id IS NULL
    ) THEN
      IF v_billing.quota_reservation_id IS NOT NULL THEN
        UPDATE public.ai_quota_reservations
        SET units = v_billing.saved_included_units + v_saved_included,
            status = CASE
              WHEN v_billing.saved_included_units + v_saved_included > 0 THEN 'consumed'
              ELSE 'released'
            END,
            daily_counted = v_billing.saved_included_units + v_saved_included > 0,
            settled_at = now()
        WHERE id = v_billing.quota_reservation_id
          AND status = 'reserved';
      END IF;
      UPDATE public.ai_flashcoin_holds
      SET status = CASE WHEN amount = 0 THEN 'consumed' ELSE 'released' END,
          amount = CASE WHEN amount = 0 THEN amount ELSE 0 END,
          settled_at = now()
      WHERE user_id = NEW.user_id
        AND action_id = v_billing.action_id
        AND resource = 'flashcards_saved'
        AND status = 'reserved';
      UPDATE public.ai_generated_flashcard_billing_reservations
      SET status = 'settled',
          settled_at = now()
      WHERE id = v_billing.id;
    END IF;
  END LOOP;

  SELECT flashcoins_balance INTO v_balance
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  NEW.balance_after := COALESCE(v_balance, 0);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_pro_flashcard_coin_holds_before_receipt()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS charge_pro_flashcard_coin_holds ON public.flashcard_save_receipts;
CREATE TRIGGER charge_pro_flashcard_coin_holds
BEFORE INSERT ON public.flashcard_save_receipts
FOR EACH ROW EXECUTE FUNCTION public.charge_pro_flashcard_coin_holds_before_receipt();

CREATE OR REPLACE FUNCTION public.release_generated_flashcard_billing_for_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing public.ai_generated_flashcard_billing_reservations%ROWTYPE;
  v_saved_included integer;
  v_has_uncertain_hold boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(OLD.user_id::text, 2));

  FOR v_billing IN
    SELECT billing.*
    FROM public.ai_generated_flashcard_billing_reservations billing
    WHERE billing.user_id = OLD.user_id
      AND billing.job_id = OLD.id
      AND billing.status IN ('reserved', 'uncertain')
    FOR UPDATE
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.ai_flashcoin_holds hold
      WHERE hold.user_id = OLD.user_id
        AND hold.action_id = v_billing.action_id
        AND hold.status = 'reserved'
        AND hold.uncertain
    ) INTO v_has_uncertain_hold;

    IF v_has_uncertain_hold OR v_billing.status = 'uncertain' THEN
      UPDATE public.ai_generated_flashcard_billing_reservations
      SET status = 'uncertain'
      WHERE id = v_billing.id;
      CONTINUE;
    END IF;

    SELECT COUNT(*) FILTER (WHERE output.saved_action_id IS NOT NULL)::integer
    INTO v_saved_included
    FROM public.ai_generated_flashcard_outputs output
    WHERE output.user_id = OLD.user_id
      AND output.action_id = v_billing.action_id
      AND output.flashcoin_cost = 0;

    UPDATE public.ai_flashcoin_holds
    SET status = 'released', amount = 0, settled_at = now()
    WHERE user_id = OLD.user_id
      AND action_id = v_billing.action_id
      AND status = 'reserved'
      AND NOT uncertain;

    IF v_billing.quota_reservation_id IS NOT NULL THEN
      UPDATE public.ai_quota_reservations
      SET units = v_saved_included,
          status = CASE WHEN v_saved_included > 0 THEN 'consumed' ELSE 'released' END,
          daily_counted = v_saved_included > 0,
          settled_at = now()
      WHERE id = v_billing.quota_reservation_id
        AND status = 'reserved';
    END IF;

    UPDATE public.ai_generated_flashcard_billing_reservations
    SET saved_included_units = v_saved_included,
        status = CASE WHEN v_saved_included + v_billing.saved_coin_units > 0
          THEN 'settled' ELSE 'released' END,
        settled_at = now()
    WHERE id = v_billing.id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_uncertain_generated_flashcard_job_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.ai_generated_flashcard_billing_reservations billing
    LEFT JOIN public.ai_flashcoin_holds hold
      ON hold.user_id = billing.user_id
     AND hold.action_id = billing.action_id
     AND hold.status = 'reserved'
    WHERE billing.user_id = OLD.user_id
      AND billing.job_id = OLD.id
      AND (
        billing.status = 'uncertain'
        OR COALESCE(hold.uncertain, false)
      )
  ) THEN
    RAISE EXCEPTION 'Uncertain flashcard billing must be reconciled before changing this job'
      USING ERRCODE = '55P03';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_uncertain_generated_flashcard_job_change()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS prevent_discard_uncertain_generated_flashcard_job
  ON public.document_jobs;
CREATE TRIGGER prevent_discard_uncertain_generated_flashcard_job
BEFORE UPDATE OF dismissed ON public.document_jobs
FOR EACH ROW
WHEN (NEW.dismissed AND NOT OLD.dismissed)
EXECUTE FUNCTION public.prevent_uncertain_generated_flashcard_job_change();
DROP TRIGGER IF EXISTS prevent_delete_uncertain_generated_flashcard_job
  ON public.document_jobs;
CREATE TRIGGER prevent_delete_uncertain_generated_flashcard_job
BEFORE DELETE ON public.document_jobs
FOR EACH ROW
EXECUTE FUNCTION public.prevent_uncertain_generated_flashcard_job_change();

CREATE OR REPLACE FUNCTION public.delete_expired_document_jobs()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint := 0;
  v_rows bigint;
  v_job record;
BEGIN
  DELETE FROM public.ai_generated_flashcard_outputs
  WHERE created_at < now() - interval '90 days';

  FOR v_job IN
    SELECT job.id, job.user_id
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
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_generated_flashcard_billing_reservations billing
        WHERE billing.user_id = job.user_id
          AND billing.job_id = job.id
          AND billing.status = 'uncertain'
      )
    ORDER BY job.user_id, job.expires_at, job.id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_job.user_id::text, 2));
    DELETE FROM public.document_jobs job
    WHERE job.id = v_job.id
      AND job.user_id = v_job.user_id
      AND job.expires_at <= clock_timestamp()
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
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_generated_flashcard_billing_reservations billing
        WHERE billing.user_id = job.user_id
          AND billing.job_id = job.id
          AND billing.status = 'uncertain'
      );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_deleted := v_deleted + v_rows;
  END LOOP;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_expired_document_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_document_jobs() TO service_role;

REVOKE ALL ON FUNCTION public.release_generated_flashcard_billing_for_job()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS release_generated_flashcard_billing_on_job_discard
  ON public.document_jobs;
CREATE TRIGGER release_generated_flashcard_billing_on_job_discard
AFTER UPDATE OF dismissed ON public.document_jobs
FOR EACH ROW
WHEN (NEW.dismissed AND NOT OLD.dismissed)
EXECUTE FUNCTION public.release_generated_flashcard_billing_for_job();
DROP TRIGGER IF EXISTS release_generated_flashcard_billing_on_job_delete
  ON public.document_jobs;
CREATE TRIGGER release_generated_flashcard_billing_on_job_delete
BEFORE DELETE ON public.document_jobs
FOR EACH ROW
EXECUTE FUNCTION public.release_generated_flashcard_billing_for_job();

CREATE OR REPLACE FUNCTION public.register_ai_generated_flashcards_pre_reserved(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid,
  p_lease_id uuid,
  p_cards jsonb,
  p_environment text
)
RETURNS TABLE (output_id uuid, ordinal integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_billing public.ai_generated_flashcard_billing_reservations%ROWTYPE;
  v_job public.document_jobs%ROWTYPE;
  v_generation_reservation public.ai_quota_reservations%ROWTYPE;
  v_lease public.ai_generation_leases%ROWTYPE;
  v_count integer;
  v_existing_count integer;
  v_job_count bigint;
  v_is_manager boolean;
  v_is_pro boolean := false;
  v_unit_cost integer;
  v_included integer;
  v_coin_units integer;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL OR p_job_id IS NULL OR p_lease_id IS NULL
     OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live')
     OR p_cards IS NULL OR jsonb_typeof(p_cards) <> 'array'
     OR jsonb_array_length(p_cards) NOT BETWEEN 1 AND 2500 THEN
    RAISE EXCEPTION 'Invalid generated flashcard registration'
      USING ERRCODE = '22023';
  END IF;

  v_count := jsonb_array_length(p_cards);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  SELECT * INTO v_job
  FROM public.document_jobs
  WHERE id = p_job_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_job.dismissed OR v_job.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Document job was discarded or expired'
      USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cards) AS card(
      question text, answer text, image_index integer
    )
    WHERE NULLIF(BTRIM(card.question), '') IS NULL
       OR NULLIF(BTRIM(card.answer), '') IS NULL
       OR length(card.question) > 20000
       OR length(card.answer) > 40000
       OR (card.image_index IS NOT NULL AND card.image_index NOT BETWEEN 0 AND 19)
  ) THEN
    RAISE EXCEPTION 'Generated flashcard content is invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.ai_generated_flashcard_outputs output
  WHERE output.user_id = p_user_id
    AND output.action_id = p_action_id;
  IF v_existing_count > 0 THEN
    IF v_existing_count <> v_count OR EXISTS (
      SELECT 1
      FROM public.ai_generated_flashcard_outputs output
      JOIN jsonb_array_elements(p_cards) WITH ORDINALITY AS input(card, ordinality)
        ON output.ordinal = input.ordinality - 1
      WHERE output.user_id = p_user_id
        AND output.action_id = p_action_id
        AND (
          output.job_id <> p_job_id
          OR output.question <> BTRIM(input.card ->> 'question')
          OR output.answer <> BTRIM(input.card ->> 'answer')
          OR output.image_index IS DISTINCT FROM NULLIF(input.card ->> 'image_index', '')::integer
        )
    ) THEN
      RAISE EXCEPTION 'Generated flashcard action was reused with different content'
        USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    SELECT output.output_id, output.ordinal
    FROM public.ai_generated_flashcard_outputs output
    WHERE output.user_id = p_user_id AND output.action_id = p_action_id
    ORDER BY output.ordinal;
    RETURN;
  END IF;

  SELECT * INTO v_lease
  FROM public.ai_generation_leases
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND lease_id = p_lease_id
    AND lease_expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generated flashcard request no longer owns the active lease'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_generation_reservation
  FROM public.ai_quota_reservations reservation
  WHERE reservation.user_id = p_user_id
    AND reservation.action_id = p_action_id
    AND reservation.job_id = p_job_id
    AND reservation.resource = 'flashcards_job'
    AND reservation.status = 'reserved'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generated flashcard request has no active authorization'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_billing
  FROM public.ai_generated_flashcard_billing_reservations reservation
  WHERE reservation.user_id = p_user_id
    AND reservation.action_id = p_action_id
    AND reservation.job_id = p_job_id
  FOR UPDATE;
  IF NOT FOUND OR v_billing.status NOT IN ('reserved', 'uncertain')
     OR v_count > v_billing.requested_units THEN
    RAISE EXCEPTION 'Generated flashcard billing reservation is missing or too small'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(public.is_app_manager_user(p_user_id), false) INTO v_is_manager;
  IF NOT v_is_manager THEN
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = p_user_id
        AND environment = p_environment
        AND status IN ('active', 'trialing', 'past_due', 'canceled')
        AND current_period_start = v_generation_reservation.period_start
        AND current_period_end = v_generation_reservation.period_end
        AND current_period_end > now()
    ) INTO v_is_pro;
  ELSE
    v_is_pro := true;
  END IF;

  SELECT COUNT(*) INTO v_job_count
  FROM public.ai_generated_flashcard_outputs
  WHERE user_id = p_user_id AND job_id = p_job_id;
  IF v_job_count + v_count > (CASE WHEN v_is_manager THEN 2500 WHEN v_is_pro THEN 150 ELSE 40 END) THEN
    RAISE EXCEPTION 'Generated flashcard job limit exceeded'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT coins_cost::integer INTO v_unit_cost
  FROM public.ai_action_costs
  WHERE id = 'bulk' AND is_active AND coins_cost > 0
    AND coins_cost = trunc(coins_cost);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Flashcard price is unavailable' USING ERRCODE = 'P0001';
  END IF;

  v_included := LEAST(v_count, v_billing.included_units);
  v_coin_units := v_count - v_included;

  IF v_billing.quota_reservation_id IS NOT NULL THEN
    UPDATE public.ai_quota_reservations
      SET units = v_included
      WHERE id = v_billing.quota_reservation_id;
  END IF;

  UPDATE public.ai_flashcoin_holds
  SET amount = v_coin_units * v_unit_cost,
      unit_cost = v_unit_cost,
      status = CASE WHEN v_coin_units > 0 THEN 'reserved' ELSE 'released' END,
      uncertain = false,
      settled_at = CASE WHEN v_coin_units > 0 THEN NULL ELSE now() END
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND resource = 'flashcards_saved'
    AND status = 'reserved';

  UPDATE public.ai_generated_flashcard_billing_reservations
  SET included_units = v_included,
      coin_units = v_coin_units,
      generated_units = v_count,
      status = 'reserved'
  WHERE id = v_billing.id;

  INSERT INTO public.ai_generated_flashcard_outputs (
    user_id, action_id, job_id, ordinal, question, answer, image_index, flashcoin_cost
  )
  SELECT
    p_user_id,
    p_action_id,
    p_job_id,
    input.ordinality::integer - 1,
    BTRIM(input.card ->> 'question'),
    BTRIM(input.card ->> 'answer'),
    NULLIF(input.card ->> 'image_index', '')::integer,
    CASE WHEN input.ordinality <= v_included THEN 0 ELSE v_unit_cost END
  FROM jsonb_array_elements(p_cards) WITH ORDINALITY AS input(card, ordinality);

  RETURN QUERY
  SELECT output.output_id, output.ordinal
  FROM public.ai_generated_flashcard_outputs output
  WHERE output.user_id = p_user_id AND output.action_id = p_action_id
  ORDER BY output.ordinal;
END;
$$;

REVOKE ALL ON FUNCTION public.register_ai_generated_flashcards_pre_reserved(uuid, uuid, uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_ai_generated_flashcards_pre_reserved(uuid, uuid, uuid, uuid, jsonb, text)
  TO service_role;
