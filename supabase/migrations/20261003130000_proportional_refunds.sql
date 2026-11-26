-- Track cumulative refunds per one-time purchase so partial Paddle
-- adjustments are idempotent and access is revoked only after a full refund.
ALTER TABLE public.user_purchases
  ADD COLUMN IF NOT EXISTS refunded_amount_cents integer NOT NULL DEFAULT 0
  CHECK (refunded_amount_cents >= 0);

UPDATE public.user_purchases
SET refunded_amount_cents = COALESCE(amount_cents, 0)
WHERE refunded_at IS NOT NULL
  AND refunded_amount_cents = 0;

CREATE TABLE IF NOT EXISTS public.purchase_refund_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_purchase_id uuid NOT NULL REFERENCES public.user_purchases(id) ON DELETE CASCADE,
  paddle_adjustment_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_purchase_id, paddle_adjustment_id)
);

CREATE INDEX IF NOT EXISTS purchase_refund_allocations_adjustment_idx
  ON public.purchase_refund_allocations(paddle_adjustment_id);

-- The original purchase-credit index covered every ledger row and prevented a
-- refund row from sharing the transaction id of its original credit.
DROP INDEX IF EXISTS public.flashcoin_ledger_tx_idx;

ALTER TABLE public.purchase_refund_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.purchase_refund_allocations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.purchase_refund_allocations TO service_role;

CREATE OR REPLACE FUNCTION public.apply_user_purchase_refund(
  p_user_purchase_id uuid,
  p_adjustment_id text,
  p_amount_cents integer,
  p_full_refund boolean DEFAULT false
)
RETURNS TABLE (
  applied_amount_cents integer,
  total_refunded_cents integer,
  fully_refunded boolean,
  already_applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.user_purchases%ROWTYPE;
  v_existing public.purchase_refund_allocations%ROWTYPE;
  v_applied integer;
  v_total integer;
BEGIN
  IF p_user_purchase_id IS NULL
     OR p_adjustment_id IS NULL
     OR btrim(p_adjustment_id) = ''
     OR p_amount_cents IS NULL
     OR p_amount_cents < 0 THEN
    RAISE EXCEPTION 'Invalid purchase refund allocation'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('purchase-refund:' || p_user_purchase_id::text, 0)
  );

  SELECT * INTO v_purchase
  FROM public.user_purchases
  WHERE id = p_user_purchase_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing
  FROM public.purchase_refund_allocations
  WHERE user_purchase_id = p_user_purchase_id
    AND paddle_adjustment_id = p_adjustment_id;
  IF FOUND THEN
    applied_amount_cents := 0;
    total_refunded_cents := COALESCE(v_purchase.refunded_amount_cents, 0);
    fully_refunded := v_purchase.amount_cents IS NOT NULL
      AND total_refunded_cents >= v_purchase.amount_cents;
    already_applied := true;
    RETURN NEXT;
    RETURN;
  END IF;

  v_applied := CASE
    WHEN p_full_refund AND v_purchase.amount_cents IS NOT NULL THEN
      GREATEST(v_purchase.amount_cents - COALESCE(v_purchase.refunded_amount_cents, 0), 0)
    WHEN v_purchase.amount_cents IS NULL THEN p_amount_cents
    ELSE LEAST(
      p_amount_cents,
      GREATEST(v_purchase.amount_cents - COALESCE(v_purchase.refunded_amount_cents, 0), 0)
    )
  END;
  v_total := COALESCE(v_purchase.refunded_amount_cents, 0) + v_applied;

  INSERT INTO public.purchase_refund_allocations (
    user_purchase_id,
    paddle_adjustment_id,
    amount_cents
  )
  VALUES (
    p_user_purchase_id,
    p_adjustment_id,
    v_applied
  );

  UPDATE public.user_purchases
  SET refunded_amount_cents = v_total,
      refunded_at = CASE
        WHEN p_full_refund OR (amount_cents IS NOT NULL AND v_total >= amount_cents) THEN now()
        ELSE refunded_at
      END,
      expires_at = CASE
        WHEN p_full_refund OR (amount_cents IS NOT NULL AND v_total >= amount_cents) THEN now()
        ELSE expires_at
      END
  WHERE id = p_user_purchase_id;

  applied_amount_cents := v_applied;
  total_refunded_cents := v_total;
  fully_refunded := p_full_refund
    OR (v_purchase.amount_cents IS NOT NULL AND v_total >= v_purchase.amount_cents);
  already_applied := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_user_purchase_refund(uuid, text, integer, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_user_purchase_refund(uuid, text, integer, boolean)
  TO service_role;
