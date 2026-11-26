CREATE TABLE public.landing_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  lang text NOT NULL DEFAULT 'en',
  notes_used integer NOT NULL DEFAULT 0,
  maps_used integer NOT NULL DEFAULT 0,
  videos_used integer NOT NULL DEFAULT 0,
  claimed_user_id uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.landing_visitors TO service_role;
ALTER TABLE public.landing_visitors ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.landing_visitor_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.landing_visitors(id) ON DELETE CASCADE,
  test_id uuid NOT NULL,
  ordinal integer NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX landing_visitor_cards_visitor_idx ON public.landing_visitor_cards(visitor_id, created_at);
GRANT ALL ON public.landing_visitor_cards TO service_role;
ALTER TABLE public.landing_visitor_cards ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.landing_test_usage (
  day date NOT NULL,
  visitor_id uuid NOT NULL REFERENCES public.landing_visitors(id) ON DELETE CASCADE,
  tests integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, visitor_id)
);
GRANT ALL ON public.landing_test_usage TO service_role;
ALTER TABLE public.landing_test_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.reserve_landing_test(_email text, _name text, _lang text, _per_email integer, _global integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_today date := (now() AT TIME ZONE 'utc')::date; v_mine integer; v_all integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('landing_test_' || v_today::text));
  INSERT INTO landing_visitors(email, full_name, lang) VALUES (lower(trim(_email)), trim(_name), _lang)
  ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, lang = EXCLUDED.lang, updated_at = now()
  RETURNING id INTO v_id;
  SELECT COALESCE(sum(tests),0) INTO v_all FROM landing_test_usage WHERE day = v_today;
  IF v_all >= _global THEN RETURN jsonb_build_object('ok', false, 'reason', 'global_limit', 'visitor_id', v_id); END IF;
  SELECT COALESCE(tests,0) INTO v_mine FROM landing_test_usage WHERE day = v_today AND visitor_id = v_id;
  IF COALESCE(v_mine,0) >= _per_email THEN RETURN jsonb_build_object('ok', false, 'reason', 'email_limit', 'visitor_id', v_id); END IF;
  INSERT INTO landing_test_usage(day, visitor_id, tests) VALUES (v_today, v_id, 1)
  ON CONFLICT (day, visitor_id) DO UPDATE SET tests = landing_test_usage.tests + 1;
  RETURN jsonb_build_object('ok', true, 'visitor_id', v_id);
END $$;
REVOKE ALL ON FUNCTION public.reserve_landing_test(text,text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_landing_test(text,text,text,integer,integer) TO service_role;