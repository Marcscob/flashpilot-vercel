-- Aperta o antifraude do kit de boas-vindas contra cadastro em massa.
--
-- O limite anterior de 50 concessões por sub-rede em 24h era permissivo
-- demais: um atacante controlando o deviceId (enviado pelo cliente) podia
-- criar até 50 contas por IP/24h e resgatar 40 FlashCoins + cotas de IA em
-- cada uma, usando apenas VPNs/proxies rotativos para escalar. Reduz para
-- 8 concessões por sub-rede em 24h — ainda dá margem para redes
-- compartilhadas legítimas (escritórios, escolas, NAT de operadora), mas
-- corta a maior parte do abuso automatizado em lote.

CREATE OR REPLACE FUNCTION public.grant_ai_welcome_kit(
  p_user_id uuid,
  p_device_hash text,
  p_subnet_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_email_confirmed timestamptz;
  v_prior_device_grants bigint;
  v_prior_subnet_grants bigint;
BEGIN
  IF p_user_id IS NULL OR p_device_hash IS NULL
     OR p_device_hash !~ '^[a-f0-9]{64}$'
     OR p_subnet_hash IS NULL
     OR p_subnet_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid welcome grant request' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE((
    SELECT enabled AND metering_ready FROM public.ai_budget_limits WHERE id = 1
  ), false) THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_subnet_hash, 1));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_hash, 2));

  UPDATE public.ai_welcome_grants
  SET subnet_hash = NULL
  WHERE granted_at < now() - interval '24 hours'
    AND subnet_hash IS NOT NULL;

  UPDATE public.ai_welcome_grants
  SET device_hash = NULL
  WHERE granted_at < now() - interval '180 days'
    AND device_hash IS NOT NULL;

  SELECT email_confirmed_at INTO v_email_confirmed
  FROM auth.users
  WHERE id = p_user_id;
  IF NOT FOUND OR v_email_confirmed IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ai_welcome_grants WHERE user_id = p_user_id) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_prior_device_grants
  FROM public.ai_welcome_grants
  WHERE device_hash = p_device_hash
    AND granted_at >= now() - interval '180 days';
  IF v_prior_device_grants >= 2 THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_prior_subnet_grants
  FROM public.ai_welcome_grants
  WHERE subnet_hash = p_subnet_hash
    AND granted_at >= now() - interval '24 hours';
  -- Allow shared networks some headroom while limiting bulk account creation.
  IF v_prior_subnet_grants >= 8 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ai_welcome_grants (user_id, device_hash, subnet_hash)
  VALUES (p_user_id, p_device_hash, p_subnet_hash);

  UPDATE public.profiles
  SET flashcoins_balance = flashcoins_balance + 40
  WHERE user_id = p_user_id;

  INSERT INTO public.flashcoin_ledger (
    user_id, amount, balance_after, reason, action_id
  )
  VALUES (
    p_user_id, 40, v_profile.flashcoins_balance + 40, 'welcome_kit',
    'welcome:' || p_user_id::text
  );

  INSERT INTO public.ai_trial_entitlements (
    user_id, maps_remaining, formats_remaining, chat_turns_remaining, granted_at
  )
  VALUES (p_user_id, 2, 3, 15, now())
  ON CONFLICT (user_id) DO UPDATE
  SET maps_remaining = 2,
      formats_remaining = 3,
      chat_turns_remaining = 15,
      granted_at = EXCLUDED.granted_at,
      updated_at = now()
  WHERE public.ai_trial_entitlements.granted_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ai_welcome_kit(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ai_welcome_kit(uuid, text, text)
  TO service_role;