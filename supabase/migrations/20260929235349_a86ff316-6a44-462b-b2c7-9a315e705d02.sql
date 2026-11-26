revoke execute on function public.has_note_access(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_note_category_access(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_subject_access(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_topic_access(uuid, uuid) from public, anon, authenticated;
grant execute on function public.has_note_access(uuid, uuid) to service_role;
grant execute on function public.has_note_category_access(uuid, uuid) to service_role;
grant execute on function public.has_subject_access(uuid, uuid) to service_role;
grant execute on function public.has_topic_access(uuid, uuid) to service_role;