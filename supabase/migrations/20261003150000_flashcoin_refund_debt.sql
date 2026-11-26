-- Preserve the unreturned part of a FlashCoin refund as a debt instead of
-- silently discarding it when the user's current balance is already low.
CREATE OR REPLACE FUNCTION public.apply_flashcoins(
  p_user_id uuid,
  p_amount numeric,
  p_reason text,
  p_action_id text DEFAULT NULL,
  p_transaction_id text DEFAULT NULL,
  p_adjustment_id text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_balance numeric;
  v_allow_refund_debt boolean :=
    p_reason = 'refund'
    AND p_amount < 0
    AND NULLIF(btrim(COALESCE(p_adjustment_id, '')), '') IS NOT NULL;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_reason IS NULL THEN
    RAISE EXCEPTION 'Invalid FlashCoin adjustment'
      USING ERRCODE = '22023';
  END IF;
  IF p_amount < 0
     AND p_reason = 'refund'
     AND NULLIF(btrim(COALESCE(p_adjustment_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Refund adjustments require an adjustment id'
      USING ERRCODE = '22023';
  END IF;

  IF p_transaction_id IS NOT NULL AND p_adjustment_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('flashcoins_txn:' || p_transaction_id, 0));
    IF EXISTS (
      SELECT 1
      FROM public.flashcoin_ledger
      WHERE paddle_transaction_id = p_transaction_id
        AND paddle_adjustment_id IS NULL
    ) THEN
      SELECT flashcoins_balance INTO v_balance
      FROM public.profiles
      WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END IF;
  END IF;

  IF p_adjustment_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('flashcoins_adj:' || p_adjustment_id, 0));
    IF EXISTS (
      SELECT 1
      FROM public.flashcoin_ledger
      WHERE paddle_adjustment_id = p_adjustment_id
    ) THEN
      SELECT flashcoins_balance INTO v_balance
      FROM public.profiles
      WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, flashcoins_balance)
  VALUES (
    p_user_id,
    CASE
      WHEN v_allow_refund_debt THEN p_amount
      ELSE GREATEST(0, p_amount)
    END
  )
  ON CONFLICT (user_id) DO UPDATE
    SET flashcoins_balance = CASE
      WHEN v_allow_refund_debt OR p_amount >= 0
        THEN public.profiles.flashcoins_balance + p_amount
      ELSE GREATEST(0, public.profiles.flashcoins_balance + p_amount)
    END
  RETURNING flashcoins_balance INTO v_balance;

  INSERT INTO public.flashcoin_ledger (
    user_id,
    amount,
    balance_after,
    reason,
    action_id,
    paddle_transaction_id,
    paddle_adjustment_id
  )
  VALUES (
    p_user_id,
    p_amount,
    v_balance,
    p_reason,
    p_action_id,
    p_transaction_id,
    p_adjustment_id
  );

  RETURN v_balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_flashcoins(uuid, numeric, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_flashcoins(uuid, numeric, text, text, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_available_flashcoins(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
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
    ), 0);
$$;

REVOKE ALL ON FUNCTION public.get_available_flashcoins(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_flashcoins(uuid)
  TO service_role;
