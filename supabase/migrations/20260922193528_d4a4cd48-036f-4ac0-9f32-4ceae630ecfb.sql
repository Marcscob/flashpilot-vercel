-- 1) Reembolso nas compras avulsas
ALTER TABLE public.user_purchases
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- Acesso deixa de valer quando a compra foi reembolsada
CREATE OR REPLACE FUNCTION public.has_pack_access(user_uuid uuid, p_product_id text)
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_purchases up
    WHERE up.user_id = user_uuid
      AND up.product_id = p_product_id
      AND up.expires_at > now()
      AND up.refunded_at IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_subject_access(user_uuid uuid, p_subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_purchases up
    JOIN public.store_products sp ON sp.id = up.product_id
    WHERE up.user_id = user_uuid
      AND sp.access_subject_id = p_subject_id
      AND up.expires_at > now()
      AND up.refunded_at IS NULL
  );
$function$;

-- 2) FlashCoins: crédito/estorno atômico e idempotente
ALTER TABLE public.flashcoin_ledger
  ADD COLUMN IF NOT EXISTS paddle_adjustment_id text;

CREATE UNIQUE INDEX IF NOT EXISTS flashcoin_ledger_adj_idx
  ON public.flashcoin_ledger (paddle_adjustment_id)
  WHERE paddle_adjustment_id IS NOT NULL;

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
    IF EXISTS (SELECT 1 FROM public.flashcoin_ledger
               WHERE paddle_transaction_id = p_transaction_id) THEN
      SELECT flashcoins_balance INTO v_balance FROM public.profiles WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END IF;
  END IF;

  IF p_adjustment_id IS NOT NULL THEN
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
GRANT EXECUTE ON FUNCTION public.apply_flashcoins(uuid, numeric, text, text, text, text) TO service_role;

-- 3) Arquivo fiscal de compras de contas excluídas
CREATE TABLE IF NOT EXISTS public.billing_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  former_user_id uuid NOT NULL,
  email text,
  product_id text,
  price_id text,
  paddle_transaction_id text,
  amount_cents integer,
  currency text,
  environment text,
  purchased_at timestamptz,
  expires_at timestamptz,
  refunded_at timestamptz,
  source text NOT NULL DEFAULT 'user_purchases',
  archived_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.billing_archive TO service_role;
ALTER TABLE public.billing_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente o sistema acessa o arquivo fiscal"
  ON public.billing_archive FOR ALL TO service_role USING (true) WITH CHECK (true);