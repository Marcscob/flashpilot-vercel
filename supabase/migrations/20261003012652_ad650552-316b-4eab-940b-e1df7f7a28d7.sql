CREATE OR REPLACE FUNCTION public.extend_subject_grant(p_user_id uuid, p_product_id text, p_expires_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.subject_grants SET expires_at = GREATEST(COALESCE(expires_at, '-infinity'::timestamptz), p_expires_at)
  WHERE user_id = p_user_id AND product_id = p_product_id AND p_expires_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.extend_subject_grant(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_subject_grant(uuid, text, timestamptz) TO service_role;
ALTER TABLE public.ai_usage DROP CONSTRAINT IF EXISTS ai_usage_kind_check;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_kind_check CHECK (kind IN ('tts_cloud', 'chat', 'stt', 'mindmap'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_day9_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_day14_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscriber_welcome_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_extension_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_blocked_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.has_pack_access(user_uuid uuid, p_product_id text)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_purchases up
    WHERE (user_uuid = auth.uid() OR auth.role() = 'service_role')
      AND up.user_id = user_uuid AND up.product_id = p_product_id
      AND up.environment IN ('live', 'owner') AND up.expires_at > now() AND up.refunded_at IS NULL);
$function$;

CREATE OR REPLACE FUNCTION public.has_subject_access(user_uuid uuid, p_subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_purchases up
    JOIN public.store_products sp ON sp.id = up.product_id
    WHERE (user_uuid = auth.uid() OR auth.role() = 'service_role')
      AND up.user_id = user_uuid AND sp.access_subject_id = p_subject_id
      AND up.environment IN ('live', 'owner') AND up.expires_at > now() AND up.refunded_at IS NULL);
$function$;

GRANT EXECUTE ON FUNCTION public.has_pack_access(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_subject_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_topic_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_note_category_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_note_access(uuid, uuid) TO authenticated, service_role;

ALTER TABLE public.user_purchases ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0);
UPDATE public.user_purchases SET refunded_amount_cents = COALESCE(amount_cents, 0) WHERE refunded_at IS NOT NULL AND refunded_amount_cents = 0;

CREATE TABLE IF NOT EXISTS public.purchase_refund_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_purchase_id uuid NOT NULL REFERENCES public.user_purchases(id) ON DELETE CASCADE,
  paddle_adjustment_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_purchase_id, paddle_adjustment_id)
);
CREATE INDEX IF NOT EXISTS purchase_refund_allocations_adjustment_idx ON public.purchase_refund_allocations(paddle_adjustment_id);
DROP INDEX IF EXISTS public.flashcoin_ledger_tx_idx;
REVOKE ALL ON public.purchase_refund_allocations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.purchase_refund_allocations TO service_role;
ALTER TABLE public.purchase_refund_allocations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_user_purchase_refund(p_user_purchase_id uuid, p_adjustment_id text, p_amount_cents integer, p_full_refund boolean DEFAULT false)
RETURNS TABLE (applied_amount_cents integer, total_refunded_cents integer, fully_refunded boolean, already_applied boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_purchase public.user_purchases%ROWTYPE;
  v_existing public.purchase_refund_allocations%ROWTYPE;
  v_applied integer;
  v_total integer;
BEGIN
  IF p_user_purchase_id IS NULL OR p_adjustment_id IS NULL OR btrim(p_adjustment_id) = '' OR p_amount_cents IS NULL OR p_amount_cents < 0 THEN
    RAISE EXCEPTION 'Invalid purchase refund allocation' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('purchase-refund:' || p_user_purchase_id::text, 0));
  SELECT * INTO v_purchase FROM public.user_purchases WHERE id = p_user_purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_existing FROM public.purchase_refund_allocations WHERE user_purchase_id = p_user_purchase_id AND paddle_adjustment_id = p_adjustment_id;
  IF FOUND THEN
    applied_amount_cents := 0;
    total_refunded_cents := COALESCE(v_purchase.refunded_amount_cents, 0);
    fully_refunded := v_purchase.amount_cents IS NOT NULL AND total_refunded_cents >= v_purchase.amount_cents;
    already_applied := true;
    RETURN NEXT; RETURN;
  END IF;
  v_applied := CASE
    WHEN p_full_refund AND v_purchase.amount_cents IS NOT NULL THEN GREATEST(v_purchase.amount_cents - COALESCE(v_purchase.refunded_amount_cents, 0), 0)
    WHEN v_purchase.amount_cents IS NULL THEN p_amount_cents
    ELSE LEAST(p_amount_cents, GREATEST(v_purchase.amount_cents - COALESCE(v_purchase.refunded_amount_cents, 0), 0))
  END;
  v_total := COALESCE(v_purchase.refunded_amount_cents, 0) + v_applied;
  INSERT INTO public.purchase_refund_allocations (user_purchase_id, paddle_adjustment_id, amount_cents) VALUES (p_user_purchase_id, p_adjustment_id, v_applied);
  UPDATE public.user_purchases
  SET refunded_amount_cents = v_total,
      refunded_at = CASE WHEN p_full_refund OR (amount_cents IS NOT NULL AND v_total >= amount_cents) THEN now() ELSE refunded_at END,
      expires_at = CASE WHEN p_full_refund OR (amount_cents IS NOT NULL AND v_total >= amount_cents) THEN now() ELSE expires_at END
  WHERE id = p_user_purchase_id;
  applied_amount_cents := v_applied;
  total_refunded_cents := v_total;
  fully_refunded := p_full_refund OR (v_purchase.amount_cents IS NOT NULL AND v_total >= v_purchase.amount_cents);
  already_applied := false;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_user_purchase_refund(uuid, text, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_user_purchase_refund(uuid, text, integer, boolean) TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_note_format_sessions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  total_parts integer NOT NULL CHECK (total_parts BETWEEN 1 AND 60),
  total_chars integer NOT NULL CHECK (total_chars BETWEEN 1 AND 60000),
  next_part integer NOT NULL DEFAULT 0 CHECK (next_part BETWEEN 0 AND total_parts),
  received_chars integer NOT NULL DEFAULT 0 CHECK (received_chars BETWEEN 0 AND total_chars),
  in_flight_part integer,
  in_flight_chars integer,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_id),
  CHECK ((in_flight_part IS NULL AND in_flight_chars IS NULL) OR (in_flight_part BETWEEN 0 AND total_parts - 1 AND in_flight_chars BETWEEN 1 AND 6000))
);
REVOKE ALL ON public.ai_note_format_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_note_format_sessions TO service_role;
ALTER TABLE public.ai_note_format_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.authorize_ai_note_format_part(p_user_id uuid, p_action_id uuid, p_part_index integer, p_total_parts integer, p_total_chars integer, p_chunk_chars integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session public.ai_note_format_sessions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL OR p_part_index IS NULL OR p_total_parts IS NULL OR p_total_chars IS NULL OR p_chunk_chars IS NULL
     OR p_part_index < 0 OR p_total_parts NOT BETWEEN 1 AND 60 OR p_part_index >= p_total_parts
     OR p_total_chars NOT BETWEEN 1 AND 60000 OR p_chunk_chars NOT BETWEEN 1 AND 6000 THEN
    RAISE EXCEPTION 'Invalid note format part' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('note-format:' || p_user_id::text || ':' || p_action_id::text, 0));
  DELETE FROM public.ai_note_format_sessions WHERE user_id = p_user_id AND action_id = p_action_id AND expires_at <= now();
  SELECT * INTO v_session FROM public.ai_note_format_sessions WHERE user_id = p_user_id AND action_id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_part_index <> 0 THEN RAISE EXCEPTION 'Note format must start at part zero' USING ERRCODE = '22023'; END IF;
    IF p_chunk_chars > p_total_chars THEN RAISE EXCEPTION 'Note format part exceeds declared note size' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.ai_note_format_sessions (user_id, action_id, total_parts, total_chars, in_flight_part, in_flight_chars)
    VALUES (p_user_id, p_action_id, p_total_parts, p_total_chars, p_part_index, p_chunk_chars);
    RETURN false;
  END IF;
  IF v_session.total_parts <> p_total_parts OR v_session.total_chars <> p_total_chars THEN
    RAISE EXCEPTION 'Note format session metadata changed' USING ERRCODE = '22023';
  END IF;
  IF p_part_index < v_session.next_part THEN RETURN true; END IF;
  IF p_part_index > v_session.next_part THEN RAISE EXCEPTION 'Note format parts must be submitted in order' USING ERRCODE = '22023'; END IF;
  IF v_session.in_flight_part IS NOT NULL THEN
    IF v_session.in_flight_part <> p_part_index OR v_session.in_flight_chars <> p_chunk_chars THEN
      RAISE EXCEPTION 'Another note format part is already in progress' USING ERRCODE = '55P03';
    END IF;
    RETURN false;
  END IF;
  IF v_session.received_chars + p_chunk_chars > v_session.total_chars THEN
    RAISE EXCEPTION 'Note format parts exceed declared note size' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ai_note_format_sessions SET in_flight_part = p_part_index, in_flight_chars = p_chunk_chars, expires_at = now() + interval '1 hour', updated_at = now()
  WHERE user_id = p_user_id AND action_id = p_action_id;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ai_note_format_part(p_user_id uuid, p_action_id uuid, p_part_index integer, p_chunk_chars integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session public.ai_note_format_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM public.ai_note_format_sessions WHERE user_id = p_user_id AND action_id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note format session not found' USING ERRCODE = 'P0002'; END IF;
  IF p_part_index < v_session.next_part THEN RETURN; END IF;
  IF v_session.in_flight_part <> p_part_index OR v_session.in_flight_chars <> p_chunk_chars THEN
    RAISE EXCEPTION 'Note format part was not authorized' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ai_note_format_sessions
  SET next_part = next_part + 1, received_chars = received_chars + p_chunk_chars, in_flight_part = NULL, in_flight_chars = NULL, updated_at = now()
  WHERE user_id = p_user_id AND action_id = p_action_id;
END;
$$;
REVOKE ALL ON FUNCTION public.authorize_ai_note_format_part(uuid, uuid, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_note_format_part(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_ai_note_format_part(uuid, uuid, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ai_note_format_part(uuid, uuid, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_flashcoins(p_user_id uuid, p_amount numeric, p_reason text, p_action_id text DEFAULT NULL, p_transaction_id text DEFAULT NULL, p_adjustment_id text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_balance numeric;
  v_allow_refund_debt boolean := p_reason = 'refund' AND p_amount < 0 AND NULLIF(btrim(COALESCE(p_adjustment_id, '')), '') IS NOT NULL;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_reason IS NULL THEN
    RAISE EXCEPTION 'Invalid FlashCoin adjustment' USING ERRCODE = '22023';
  END IF;
  IF p_amount < 0 AND p_reason = 'refund' AND NULLIF(btrim(COALESCE(p_adjustment_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Refund adjustments require an adjustment id' USING ERRCODE = '22023';
  END IF;
  IF p_transaction_id IS NOT NULL AND p_adjustment_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('flashcoins_txn:' || p_transaction_id, 0));
    IF EXISTS (SELECT 1 FROM public.flashcoin_ledger WHERE paddle_transaction_id = p_transaction_id AND paddle_adjustment_id IS NULL) THEN
      SELECT flashcoins_balance INTO v_balance FROM public.profiles WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END IF;
  END IF;
  IF p_adjustment_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('flashcoins_adj:' || p_adjustment_id, 0));
    IF EXISTS (SELECT 1 FROM public.flashcoin_ledger WHERE paddle_adjustment_id = p_adjustment_id) THEN
      SELECT flashcoins_balance INTO v_balance FROM public.profiles WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END IF;
  END IF;
  INSERT INTO public.profiles (user_id, flashcoins_balance)
  VALUES (p_user_id, CASE WHEN v_allow_refund_debt THEN p_amount ELSE GREATEST(0, p_amount) END)
  ON CONFLICT (user_id) DO UPDATE
    SET flashcoins_balance = CASE
      WHEN v_allow_refund_debt OR p_amount >= 0 THEN public.profiles.flashcoins_balance + p_amount
      ELSE GREATEST(0, public.profiles.flashcoins_balance + p_amount)
    END
  RETURNING flashcoins_balance INTO v_balance;
  INSERT INTO public.flashcoin_ledger (user_id, amount, balance_after, reason, action_id, paddle_transaction_id, paddle_adjustment_id)
  VALUES (p_user_id, p_amount, v_balance, p_reason, p_action_id, p_transaction_id, p_adjustment_id);
  RETURN v_balance;
END;
$function$;
REVOKE ALL ON FUNCTION public.apply_flashcoins(uuid, numeric, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_flashcoins(uuid, numeric, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_available_flashcoins(p_user_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT profile.flashcoins_balance FROM public.profiles profile WHERE profile.user_id = p_user_id), 0)
    - COALESCE((SELECT SUM(hold.amount) FROM public.ai_flashcoin_holds hold WHERE hold.user_id = p_user_id AND hold.status = 'reserved' AND hold.expires_at > now()), 0);
$$;
REVOKE ALL ON FUNCTION public.get_available_flashcoins(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_flashcoins(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.is_user_trial_blocked(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_trial_days integer;
  v_trial_launched_at timestamptz := '2026-10-01 00:00:00+00';
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;
  IF COALESCE(public.is_app_manager_user(p_user_id), false) THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions sub WHERE sub.user_id = p_user_id AND sub.environment = 'live'
      AND sub.status IN ('active', 'trialing', 'past_due', 'canceled') AND sub.current_period_start <= now() AND sub.current_period_end > now()) THEN
    RETURN false;
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_profile.created_at < v_trial_launched_at THEN RETURN false; END IF;
  v_trial_days := CASE WHEN v_profile.trial_extension_granted_at IS NOT NULL THEN 20 ELSE 15 END;
  RETURN now() >= v_profile.created_at + make_interval(days => v_trial_days);
END;
$$;
REVOKE ALL ON FUNCTION public.is_user_trial_blocked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_trial_blocked(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_trial_status(p_user_id uuid)
RETURNS TABLE (blocked boolean, trial_ends_at timestamptz, extension_granted boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_trial_days integer;
  v_trial_launched_at timestamptz := '2026-10-01 00:00:00+00';
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    blocked := false; trial_ends_at := NULL; extension_granted := false;
    RETURN NEXT; RETURN;
  END IF;
  extension_granted := v_profile.trial_extension_granted_at IS NOT NULL;
  IF v_profile.created_at < v_trial_launched_at THEN
    blocked := false; trial_ends_at := NULL;
    RETURN NEXT; RETURN;
  END IF;
  v_trial_days := CASE WHEN extension_granted THEN 20 ELSE 15 END;
  blocked := public.is_user_trial_blocked(p_user_id);
  trial_ends_at := v_profile.created_at + make_interval(days => v_trial_days);
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.get_trial_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_status(uuid) TO service_role;