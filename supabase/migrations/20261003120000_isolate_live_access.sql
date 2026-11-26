-- Lote 2: compras e assinaturas de sandbox não liberam recursos de produção.

CREATE OR REPLACE FUNCTION public.has_pack_access(user_uuid uuid, p_product_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_purchases up
    WHERE (
        user_uuid = auth.uid()
        OR auth.role() = 'service_role'
      )
      AND up.user_id = user_uuid
      AND up.product_id = p_product_id
      AND up.environment IN ('live', 'owner')
      AND up.expires_at > now()
      AND up.refunded_at IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_subject_access(user_uuid uuid, p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_purchases up
    JOIN public.store_products sp ON sp.id = up.product_id
    WHERE (
        user_uuid = auth.uid()
        OR auth.role() = 'service_role'
      )
      AND up.user_id = user_uuid
      AND sp.access_subject_id = p_subject_id
      AND up.environment IN ('live', 'owner')
      AND up.expires_at > now()
      AND up.refunded_at IS NULL
  );
$function$;

-- These helpers are referenced by RLS policies for authenticated reads. Keep
-- direct calls scoped to the current user while allowing server-side jobs.
GRANT EXECUTE ON FUNCTION public.has_pack_access(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_subject_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_topic_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_note_category_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_note_access(uuid, uuid) TO authenticated, service_role;

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

  v_trial_days := CASE WHEN v_profile.trial_extension_granted_at IS NOT NULL THEN 20 ELSE 15 END;
  RETURN now() >= v_profile.created_at + make_interval(days => v_trial_days);
END;
$$;
