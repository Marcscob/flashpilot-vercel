CREATE OR REPLACE FUNCTION public.trial_end_at(p_created timestamptz, p_ext timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_ext IS NULL THEN p_created + interval '15 days'
    ELSE GREATEST(p_created + interval '15 days', p_ext + interval '5 days') END
$$;

CREATE OR REPLACE FUNCTION public.is_user_trial_blocked(p_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
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
  RETURN now() >= public.trial_end_at(v_profile.created_at, v_profile.trial_extension_granted_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_trial_status(p_user_id uuid)
 RETURNS TABLE(blocked boolean, trial_ends_at timestamp with time zone, extension_granted boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
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
  blocked := public.is_user_trial_blocked(p_user_id);
  trial_ends_at := public.trial_end_at(v_profile.created_at, v_profile.trial_extension_granted_at);
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_trial_extension(p_user_id uuid)
 RETURNS TABLE(trial_ends_at timestamp with time zone, extension_granted boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_count integer;
  v_bonus integer;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Invalid user' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 3));
  SELECT COUNT(*) INTO v_count FROM public.flashcards WHERE user_id = p_user_id AND source_id IS NULL;
  v_bonus := GREATEST(0, 40 - GREATEST(0, 100 - v_count));
  UPDATE public.profiles SET trial_extension_granted_at = now(), trial_bonus_flashcards = v_bonus
  WHERE user_id = p_user_id AND trial_extension_granted_at IS NULL;
  SELECT * INTO v_profile FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002'; END IF;
  trial_ends_at := public.trial_end_at(v_profile.created_at, v_profile.trial_extension_granted_at);
  extension_granted := true;
  RETURN NEXT;
END;
$function$;

-- Marcelo's extension was consumed instantly by the old formula; restart it now.
UPDATE public.profiles SET trial_extension_granted_at = now()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'marcscob@hotmail.com');