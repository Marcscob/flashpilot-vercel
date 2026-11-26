CREATE OR REPLACE FUNCTION public.reserve_ai_quota_included_only_v1(
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
  v_is_pro2 boolean := false;
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
      SELECT COALESCE(v_is_app_manager, false) OR EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = p_user_id
          AND environment = p_environment
          AND current_period_start = v_existing.period_start
          AND current_period_end = v_existing.period_end
          AND current_period_end > now()
          AND (price_id IN ('pro_2_monthly', 'pro_2_yearly') OR product_id = 'pro_2')
      ) INTO v_is_pro2;
      v_limit := CASE p_resource
        WHEN 'flashcards_saved' THEN CASE WHEN v_is_pro2 THEN 2200 ELSE 700 END
        WHEN 'mindmap' THEN CASE WHEN v_is_pro2 THEN 150 ELSE 50 END
        WHEN 'note_format' THEN CASE WHEN v_is_pro2 THEN 180 ELSE 60 END
        WHEN 'chat_turn' THEN CASE WHEN v_is_pro2 THEN 1200 ELSE 400 END
        WHEN 'tts_standalone' THEN CASE WHEN v_is_pro2 THEN 300000 ELSE 100000 END
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
    v_is_pro2 := FOUND AND (
      v_sub.price_id IN ('pro_2_monthly', 'pro_2_yearly') OR v_sub.product_id = 'pro_2'
    );
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
      WHEN 'flashcards_saved' THEN CASE WHEN v_is_pro2 THEN 2200 ELSE 700 END
      WHEN 'mindmap' THEN CASE WHEN v_is_pro2 THEN 150 ELSE 50 END
      WHEN 'note_format' THEN CASE WHEN v_is_pro2 THEN 180 ELSE 60 END
      WHEN 'chat_turn' THEN CASE WHEN v_is_pro2 THEN 1200 ELSE 400 END
      WHEN 'tts_standalone' THEN CASE WHEN v_is_pro2 THEN 300000 ELSE 100000 END
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

REVOKE ALL ON FUNCTION public.reserve_ai_quota_included_only_v1(uuid, uuid, uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota_included_only_v1(uuid, uuid, uuid, text, bigint, text)
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
  v_is_pro2 boolean := false;
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
    v_is_pro2 := FOUND AND (
      v_subscription.price_id IN ('pro_2_monthly', 'pro_2_yearly')
      OR v_subscription.product_id = 'pro_2'
    );
  ELSE
    v_is_pro := true;
  END IF;

  IF p_requested_units > (CASE WHEN v_is_manager THEN 2500 WHEN v_is_pro2 THEN 250 WHEN v_is_pro THEN 150 ELSE 40 END) THEN
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
    v_included := LEAST(p_requested_units, GREATEST(0, (CASE WHEN v_is_pro2 THEN 2200 ELSE 700 END) - v_used)::integer);
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
  v_is_pro2 boolean := false;
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
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = p_user_id
        AND environment = p_environment
        AND status IN ('active', 'trialing', 'past_due', 'canceled')
        AND current_period_start = v_generation_reservation.period_start
        AND current_period_end = v_generation_reservation.period_end
        AND current_period_end > now()
        AND (price_id IN ('pro_2_monthly', 'pro_2_yearly') OR product_id = 'pro_2')
    ) INTO v_is_pro2;
  ELSE
    v_is_pro := true;
  END IF;

  SELECT COUNT(*) INTO v_job_count
  FROM public.ai_generated_flashcard_outputs
  WHERE user_id = p_user_id AND job_id = p_job_id;
  IF v_job_count + v_count > (CASE WHEN v_is_manager THEN 2500 WHEN v_is_pro2 THEN 250 WHEN v_is_pro THEN 150 ELSE 40 END) THEN
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