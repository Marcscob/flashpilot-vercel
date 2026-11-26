REVOKE ALL ON FUNCTION public.reserve_ai_quota_included_only_v1(uuid, uuid, uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota_included_only_v1(uuid, uuid, uuid, text, bigint, text)
  TO service_role;