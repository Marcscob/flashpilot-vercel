CREATE OR REPLACE FUNCTION public.has_pack_access(user_uuid uuid, p_product_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_purchases up
    WHERE up.user_id = user_uuid
      AND up.product_id = p_product_id
      AND up.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_subject_access(user_uuid uuid, p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_purchases up
    JOIN public.store_products sp ON sp.id = up.product_id
    WHERE up.user_id = user_uuid
      AND sp.access_subject_id = p_subject_id
      AND up.expires_at > now()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_pack_access(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_subject_access(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_pack_access(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_subject_access(uuid, uuid) TO authenticated, service_role;