CREATE OR REPLACE FUNCTION public.is_app_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    lower(COALESCE(auth.jwt() ->> 'email', '')) = 'guit1966@gmail.com'
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_app_manager', 'false') = 'true';
$$;

REVOKE ALL ON FUNCTION public.is_app_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_app_manager() TO authenticated, service_role;

DROP POLICY IF EXISTS subjects_delete_own_created ON public.subjects;
CREATE POLICY subjects_delete_own_created ON public.subjects
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  AND (source_id IS NULL OR public.is_app_manager())
);

CREATE OR REPLACE FUNCTION public.protect_purchased_content_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.source_id IS NULL OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN OLD;
  END IF;
  IF public.is_app_manager() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Conteúdo de matéria comprada não pode ser excluído.';
END;
$$;