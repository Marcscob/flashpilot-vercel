ALTER FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) TO service_role;