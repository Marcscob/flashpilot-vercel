REVOKE ALL ON FUNCTION public.bump_tts_cache_usage(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.bump_tts_cache_usage(uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.bump_tts_cache_usage(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_tts_cache_usage(uuid, text) TO service_role;