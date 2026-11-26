CREATE OR REPLACE FUNCTION public.reserve_ai_quota_included_only_v1(p_user_id uuid, p_action_id uuid, p_job_id uuid, p_resource text, p_units bigint, p_environment text)
 RETURNS TABLE(reservation_id uuid, is_pro boolean, period_start timestamp with time zone, period_end timestamp with time zone, remaining_units bigint, was_existing boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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
    IF p_resource = 'tts_standalone' THEN
      -- Narração liberada no Free, limitada por caracteres por dia (UTC).
      SELECT COALESCE(SUM(units), 0) INTO v_used
      FROM public.ai_quota_reservations
      WHERE user_id = p_user_id
        AND resource = 'tts_standalone'
        AND status IN ('reserved', 'consumed')
        AND created_at >= v_day_start;
      v_balance := GREATEST(0, 20000 - v_used)::integer;
    END IF;
    IF p_resource = 'flashcards_saved' THEN
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
$function$;