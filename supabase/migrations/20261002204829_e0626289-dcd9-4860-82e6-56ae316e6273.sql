CREATE OR REPLACE FUNCTION public.reserve_ai_feature_flashcoins(
  p_user_id uuid, p_action_id uuid, p_job_id uuid, p_resource text, p_cost_id text, p_environment text, p_units integer DEFAULT 1
)
RETURNS TABLE (hold_id uuid, quota_reservation_id uuid, is_pro boolean, coins_reserved integer, available_after numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
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
  v_hold_id uuid;
  v_hold_qr uuid;
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
    UPDATE public.ai_flashcoin_holds h
    SET status = 'released', settled_at = now()
    WHERE h.user_id = p_user_id AND h.status = 'reserved' AND NOT h.uncertain AND h.expires_at <= now()
    RETURNING h.quota_reservation_id AS qr_id
  )
  UPDATE public.ai_quota_reservations reservation
  SET status = 'released', daily_counted = false, settled_at = now()
  FROM expired_holds expired
  WHERE reservation.id = expired.qr_id AND reservation.status = 'reserved';

  IF EXISTS (
    SELECT 1 FROM public.ai_flashcoin_holds hold
    WHERE hold.user_id = p_user_id AND hold.action_id = p_action_id AND hold.resource = p_resource
  ) THEN
    RAISE EXCEPTION 'AI FlashCoin action was already reserved or settled' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_cost FROM public.ai_action_costs c WHERE c.id = p_cost_id AND c.is_active;
  IF NOT FOUND OR v_cost.coins_cost <= 0
     OR v_cost.coins_cost <> trunc(v_cost.coins_cost)
     OR v_cost.coins_cost * p_units > 2147483647 THEN
    RAISE EXCEPTION 'AI FlashCoin price is unavailable' USING ERRCODE = 'P0001';
  END IF;
  v_amount := (v_cost.coins_cost * p_units)::integer;

  SELECT * INTO v_profile FROM public.profiles pr WHERE pr.user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;
  v_balance := v_profile.flashcoins_balance;

  SELECT * INTO v_sub FROM public.subscriptions s
  WHERE s.user_id = p_user_id AND s.environment = p_environment
    AND s.status IN ('active', 'trialing', 'past_due', 'canceled')
    AND s.current_period_start <= now() AND s.current_period_end > now()
  ORDER BY s.created_at DESC LIMIT 1;

  IF FOUND THEN
    v_period_start := v_sub.current_period_start;
    v_period_end := v_sub.current_period_end;
  ELSE
    v_period_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
    v_period_end := v_period_start + interval '1 day';
  END IF;

  SELECT COALESCE(SUM(hold.amount), 0) INTO v_held
  FROM public.ai_flashcoin_holds hold
  WHERE hold.user_id = p_user_id AND hold.status = 'reserved' AND hold.expires_at > now();

  IF v_balance - v_held < v_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente de FlashCoins' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_quota_reservations (user_id, action_id, job_id, resource, units, period_start, period_end, status)
  VALUES (p_user_id, p_action_id, p_job_id, p_resource, p_units, v_period_start, v_period_end, 'reserved')
  RETURNING id INTO v_quota_reservation_id;

  INSERT INTO public.ai_flashcoin_holds (
    user_id, action_id, job_id, resource, cost_id, amount, unit_cost, quota_reservation_id, status, expires_at
  )
  VALUES (
    p_user_id, p_action_id, p_job_id, p_resource, p_cost_id, v_amount, v_cost.coins_cost::integer,
    v_quota_reservation_id, 'reserved',
    CASE WHEN p_resource = 'flashcards_saved' THEN (
        SELECT job.expires_at FROM public.document_jobs job WHERE job.id = p_job_id AND job.user_id = p_user_id)
      ELSE now() + interval '15 minutes' END
  )
  RETURNING id, ai_flashcoin_holds.quota_reservation_id INTO v_hold_id, v_hold_qr;

  hold_id := v_hold_id;
  quota_reservation_id := v_hold_qr;
  is_pro := COALESCE(public.is_app_manager_user(p_user_id), false) OR COALESCE(v_sub.user_id IS NOT NULL, false);
  coins_reserved := v_amount;
  available_after := GREATEST(0, v_balance - v_held - v_amount);
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_feature_flashcoins(uuid, uuid, uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_feature_flashcoins(uuid, uuid, uuid, text, text, text, integer) TO service_role;