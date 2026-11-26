CREATE OR REPLACE FUNCTION public.can_read_shared_card_video(p_video_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
 SELECT 1 FROM public.card_videos v JOIN public.flashcards f ON f.id = v.card_id
 WHERE v.id = p_video_id AND public.is_app_manager_user(v.user_id)
 AND public.is_app_manager_user(f.user_id) AND public.has_topic_access(auth.uid(), f.topic_id)
 );
$$;
REVOKE ALL ON FUNCTION public.can_read_shared_card_video(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_shared_card_video(uuid) TO authenticated, service_role;
ALTER POLICY "authorized official card videos read" ON public.card_videos USING (public.can_read_shared_card_video(id));