-- Bind every note-format chunk to one server-side authorization. This prevents
-- reusing a valid part-0 action to submit arbitrarily large later chunks.
CREATE TABLE IF NOT EXISTS public.ai_note_format_sessions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  total_parts integer NOT NULL CHECK (total_parts BETWEEN 1 AND 60),
  total_chars integer NOT NULL CHECK (total_chars BETWEEN 1 AND 60000),
  next_part integer NOT NULL DEFAULT 0 CHECK (next_part BETWEEN 0 AND total_parts),
  received_chars integer NOT NULL DEFAULT 0 CHECK (received_chars BETWEEN 0 AND total_chars),
  in_flight_part integer,
  in_flight_chars integer,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_id),
  CHECK (
    (in_flight_part IS NULL AND in_flight_chars IS NULL)
    OR (
      in_flight_part BETWEEN 0 AND total_parts - 1
      AND in_flight_chars BETWEEN 1 AND 6000
    )
  )
);

ALTER TABLE public.ai_note_format_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_note_format_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_note_format_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.authorize_ai_note_format_part(
  p_user_id uuid,
  p_action_id uuid,
  p_part_index integer,
  p_total_parts integer,
  p_total_chars integer,
  p_chunk_chars integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.ai_note_format_sessions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL
     OR p_action_id IS NULL
     OR p_part_index IS NULL
     OR p_total_parts IS NULL
     OR p_total_chars IS NULL
     OR p_chunk_chars IS NULL
     OR p_part_index < 0
     OR p_total_parts NOT BETWEEN 1 AND 60
     OR p_part_index >= p_total_parts
     OR p_total_chars NOT BETWEEN 1 AND 60000
     OR p_chunk_chars NOT BETWEEN 1 AND 6000 THEN
    RAISE EXCEPTION 'Invalid note format part'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('note-format:' || p_user_id::text || ':' || p_action_id::text, 0)
  );

  DELETE FROM public.ai_note_format_sessions
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND expires_at <= now();

  SELECT * INTO v_session
  FROM public.ai_note_format_sessions
  WHERE user_id = p_user_id
    AND action_id = p_action_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_part_index <> 0 THEN
      RAISE EXCEPTION 'Note format must start at part zero'
        USING ERRCODE = '22023';
    END IF;
    IF p_chunk_chars > p_total_chars THEN
      RAISE EXCEPTION 'Note format part exceeds declared note size'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.ai_note_format_sessions (
      user_id,
      action_id,
      total_parts,
      total_chars,
      in_flight_part,
      in_flight_chars
    )
    VALUES (
      p_user_id,
      p_action_id,
      p_total_parts,
      p_total_chars,
      p_part_index,
      p_chunk_chars
    );
    RETURN false;
  END IF;

  IF v_session.total_parts <> p_total_parts
     OR v_session.total_chars <> p_total_chars THEN
    RAISE EXCEPTION 'Note format session metadata changed'
      USING ERRCODE = '22023';
  END IF;

  IF p_part_index < v_session.next_part THEN
    RETURN true;
  END IF;
  IF p_part_index > v_session.next_part THEN
    RAISE EXCEPTION 'Note format parts must be submitted in order'
      USING ERRCODE = '22023';
  END IF;

  IF v_session.in_flight_part IS NOT NULL THEN
    IF v_session.in_flight_part <> p_part_index
       OR v_session.in_flight_chars <> p_chunk_chars THEN
      RAISE EXCEPTION 'Another note format part is already in progress'
        USING ERRCODE = '55P03';
    END IF;
    RETURN false;
  END IF;

  IF v_session.received_chars + p_chunk_chars > v_session.total_chars THEN
    RAISE EXCEPTION 'Note format parts exceed declared note size'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_note_format_sessions
  SET in_flight_part = p_part_index,
      in_flight_chars = p_chunk_chars,
      expires_at = now() + interval '1 hour',
      updated_at = now()
  WHERE user_id = p_user_id
    AND action_id = p_action_id;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ai_note_format_part(
  p_user_id uuid,
  p_action_id uuid,
  p_part_index integer,
  p_chunk_chars integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.ai_note_format_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session
  FROM public.ai_note_format_sessions
  WHERE user_id = p_user_id
    AND action_id = p_action_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note format session not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF p_part_index < v_session.next_part THEN
    RETURN;
  END IF;
  IF v_session.in_flight_part <> p_part_index
     OR v_session.in_flight_chars <> p_chunk_chars THEN
    RAISE EXCEPTION 'Note format part was not authorized'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_note_format_sessions
  SET next_part = next_part + 1,
      received_chars = received_chars + p_chunk_chars,
      in_flight_part = NULL,
      in_flight_chars = NULL,
      updated_at = now()
  WHERE user_id = p_user_id
    AND action_id = p_action_id;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_ai_note_format_part(uuid, uuid, integer, integer, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_note_format_part(uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_ai_note_format_part(uuid, uuid, integer, integer, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ai_note_format_part(uuid, uuid, integer, integer)
  TO service_role;
