CREATE TABLE IF NOT EXISTS public.landing_source_usage (
  day date NOT NULL,
  client_key text NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, client_key)
);
GRANT ALL ON public.landing_source_usage TO service_role;
ALTER TABLE public.landing_source_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reserve_landing_source(_client_key text, _per_client integer, _global integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'utc')::date; v_mine integer; v_all integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('landing_source_' || v_today::text));
  SELECT COALESCE(sum(calls),0) INTO v_all FROM landing_source_usage WHERE day = v_today;
  IF v_all >= _global THEN RETURN jsonb_build_object('ok', false, 'reason', 'global_limit'); END IF;
  SELECT COALESCE(calls,0) INTO v_mine FROM landing_source_usage WHERE day = v_today AND client_key = _client_key;
  IF COALESCE(v_mine,0) >= _per_client THEN RETURN jsonb_build_object('ok', false, 'reason', 'client_limit'); END IF;
  INSERT INTO landing_source_usage(day, client_key, calls) VALUES (v_today, _client_key, 1)
  ON CONFLICT (day, client_key) DO UPDATE SET calls = landing_source_usage.calls + 1;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.reserve_landing_source(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_landing_source(text,integer,integer) TO service_role;