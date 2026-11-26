CREATE OR REPLACE FUNCTION public.get_trial_status_by_email(p_email text)
RETURNS TABLE (trial_ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT trial.trial_ends_at
  FROM auth.users AS account
  CROSS JOIN LATERAL public.get_trial_status(account.id) AS trial
  WHERE account.email IS NOT NULL
    AND lower(account.email) = lower(btrim(p_email))
  ORDER BY account.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_trial_status_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_trial_status_by_email(text) TO service_role;