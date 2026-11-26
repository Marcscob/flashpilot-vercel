-- apply_flashcoins() tinha uma corrida de check-then-act: duas chamadas
-- concorrentes com o mesmo p_transaction_id (ou p_adjustment_id) podiam
-- ambas passar pelo EXISTS antes de qualquer INSERT, creditando/estornando
-- FlashCoins em dobro.

CREATE UNIQUE INDEX IF NOT EXISTS flashcoin_ledger_txn_credit_idx
  ON public.flashcoin_ledger (paddle_transaction_id)
  WHERE paddle_transaction_id IS NOT NULL AND paddle_adjustment_id IS NULL;

CREATE OR REPLACE FUNCTION public.apply_flashcoins(
  p_user_id uuid,
  p_amount numeric,
  p_reason text,
  p_action_id text DEFAULT NULL,
  p_transaction_id text DEFAULT NULL,
  p_adjustment_id text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_balance numeric;
BEGIN
  IF p_transaction_id IS NOT NULL AND p_adjustment_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('flashcoins_txn:' || p_transaction_id, 0));
    IF EXISTS (SELECT 1 FROM public.flashcoin_ledger
               WHERE paddle_transaction_id = p_transaction_id
                 AND paddle_adjustment_id IS NULL) THEN
      SELECT flashcoins_balance INTO v_balance FROM public.profiles WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END IF;
  END IF;

  IF p_adjustment_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('flashcoins_adj:' || p_adjustment_id, 0));
    IF EXISTS (SELECT 1 FROM public.flashcoin_ledger
               WHERE paddle_adjustment_id = p_adjustment_id) THEN
      SELECT flashcoins_balance INTO v_balance FROM public.profiles WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, flashcoins_balance)
  VALUES (p_user_id, GREATEST(0, p_amount))
  ON CONFLICT (user_id) DO UPDATE
    SET flashcoins_balance = GREATEST(0, public.profiles.flashcoins_balance + p_amount)
  RETURNING flashcoins_balance INTO v_balance;

  INSERT INTO public.flashcoin_ledger
    (user_id, amount, balance_after, reason, action_id, paddle_transaction_id, paddle_adjustment_id)
  VALUES
    (p_user_id, p_amount, v_balance, p_reason, p_action_id, p_transaction_id, p_adjustment_id);

  RETURN v_balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_flashcoins(uuid, numeric, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_flashcoins(uuid, numeric, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_flashcoins(uuid, numeric, text, text, text, text) TO service_role;