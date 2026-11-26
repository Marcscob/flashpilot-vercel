CREATE OR REPLACE FUNCTION public.quarantine_ai_generation_lease(
  p_user_id uuid,
  p_action_id uuid,
  p_lease_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_generation_leases
  SET lease_id = gen_random_uuid(),
      lease_expires_at = GREATEST(
        lease_expires_at,
        clock_timestamp() + interval '60 seconds'
      ),
      updated_at = clock_timestamp()
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND lease_id = p_lease_id;
$$;

REVOKE ALL ON FUNCTION public.quarantine_ai_generation_lease(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quarantine_ai_generation_lease(uuid, uuid, uuid)
  TO service_role;