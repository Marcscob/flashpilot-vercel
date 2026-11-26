-- Reaplica a regra do trial depois das migrations de isolamento de ambiente.
-- Contas existentes antes do lançamento do trial de 15 dias permanecem
-- grandfathered; contas novas seguem 15 dias (ou 20 com a extensão).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_extension_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_blocked_email_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_user_trial_blocked(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_trial_days integer;
  v_trial_launched_at timestamptz := '2026-10-01 00:00:00+00';
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(public.is_app_manager_user(p_user_id), false) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subscriptions sub
    WHERE sub.user_id = p_user_id
      AND sub.environment = 'live'
      AND sub.status IN ('active', 'trialing', 'past_due', 'canceled')
      AND sub.current_period_start <= now()
      AND sub.current_period_end > now()
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_profile.created_at < v_trial_launched_at THEN
    RETURN false;
  END IF;

  v_trial_days := CASE
    WHEN v_profile.trial_extension_granted_at IS NOT NULL THEN 20
    ELSE 15
  END;
  RETURN now() >= v_profile.created_at + make_interval(days => v_trial_days);
END;
$$;

REVOKE ALL ON FUNCTION public.is_user_trial_blocked(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_trial_blocked(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_trial_status(p_user_id uuid)
RETURNS TABLE (
  blocked boolean,
  trial_ends_at timestamptz,
  extension_granted boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_trial_days integer;
  v_trial_launched_at timestamptz := '2026-10-01 00:00:00+00';
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    blocked := false;
    trial_ends_at := NULL;
    extension_granted := false;
    RETURN NEXT;
    RETURN;
  END IF;

  extension_granted := v_profile.trial_extension_granted_at IS NOT NULL;
  IF v_profile.created_at < v_trial_launched_at THEN
    blocked := false;
    trial_ends_at := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  v_trial_days := CASE WHEN extension_granted THEN 20 ELSE 15 END;
  blocked := public.is_user_trial_blocked(p_user_id);
  trial_ends_at := v_profile.created_at + make_interval(days => v_trial_days);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trial_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_status(uuid) TO service_role;
