REVOKE ALL ON public.community_curation FROM anon,authenticated;
GRANT SELECT ON public.community_curation TO authenticated;
GRANT ALL ON public.community_curation TO service_role;
REVOKE ALL ON public.community_curation_events FROM anon,authenticated;
GRANT SELECT ON public.community_curation_events TO authenticated;
GRANT ALL ON public.community_curation_events TO service_role;