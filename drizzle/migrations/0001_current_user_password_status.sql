CREATE OR REPLACE FUNCTION public.current_user_has_password()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_has_password boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(length(account.encrypted_password), 0) > 0
  INTO v_has_password
  FROM auth.users AS account
  WHERE account.id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = '42501';
  END IF;
  RETURN v_has_password;
END;
$function$;
REVOKE ALL ON FUNCTION public.current_user_has_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_password() TO authenticated;
COMMENT ON FUNCTION public.current_user_has_password() IS 'Returns only password existence for the authenticated caller; never exposes password hashes or accepts another account ID.';