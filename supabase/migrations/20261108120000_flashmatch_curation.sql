ALTER TABLE public.game_decks ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;
ALTER TABLE public.game_decks ADD COLUMN IF NOT EXISTS source_id uuid;
-- Uma cópia por game oficial e por aluno, mesmo com entregas concorrentes (NULL não conflita).
CREATE UNIQUE INDEX IF NOT EXISTS game_decks_user_source_uidx ON public.game_decks (user_id, source_id);

CREATE TABLE IF NOT EXISTS public.community_game_curation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_deck_id uuid UNIQUE,
  submitted_by uuid,
  title text NOT NULL,
  subject text NOT NULL,
  chapter text NOT NULL,
  topic text NOT NULL,
  language text NOT NULL DEFAULT 'pt',
  rounds jsonb NOT NULL,
  eligible boolean NOT NULL DEFAULT false,
  risk text NOT NULL DEFAULT 'rights_uncertain',
  audit_reason text NOT NULL DEFAULT '',
  audited boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  version integer NOT NULL DEFAULT 1,
  rights_confirmed boolean NOT NULL DEFAULT false,
  rights_notes text NOT NULL DEFAULT '',
  review_notes text NOT NULL DEFAULT '',
  reviewed_by uuid,
  reviewed_at timestamptz,
  official_deck_id uuid UNIQUE REFERENCES public.game_decks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_game_curation_status_idx ON public.community_game_curation (status, created_at);

CREATE TABLE IF NOT EXISTS public.community_game_curation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curation_id uuid NOT NULL REFERENCES public.community_game_curation(id),
  reviewer_id uuid NOT NULL,
  decision text NOT NULL,
  version integer NOT NULL,
  review_notes text NOT NULL,
  rights_notes text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_game_curation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_game_curation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_game_curation FROM anon, authenticated;
REVOKE ALL ON public.community_game_curation_events FROM anon, authenticated;
GRANT SELECT ON public.community_game_curation TO authenticated;
GRANT SELECT ON public.community_game_curation_events TO authenticated;
GRANT ALL ON public.community_game_curation TO service_role;
GRANT ALL ON public.community_game_curation_events TO service_role;

DROP POLICY IF EXISTS manager_read_game_curation ON public.community_game_curation;
CREATE POLICY manager_read_game_curation ON public.community_game_curation
  FOR SELECT TO authenticated USING (public.is_app_manager());
DROP POLICY IF EXISTS manager_read_game_curation_events ON public.community_game_curation_events;
CREATE POLICY manager_read_game_curation_events ON public.community_game_curation_events
  FOR SELECT TO authenticated USING (public.is_app_manager());

-- Se o aluno apagar o game enquanto ele ainda aguarda revisão, a candidatura é retirada.
CREATE OR REPLACE FUNCTION public.withdraw_pending_game_curation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.community_game_curation WHERE source_deck_id = OLD.id AND status = 'pending';
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.withdraw_pending_game_curation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS withdraw_pending_game_curation ON public.game_decks;
CREATE TRIGGER withdraw_pending_game_curation AFTER DELETE ON public.game_decks
  FOR EACH ROW EXECUTE FUNCTION public.withdraw_pending_game_curation();

CREATE OR REPLACE FUNCTION public.review_game_curation(
  p_id uuid, p_version integer, p_reviewer uuid, p_decision text,
  p_draft jsonb, p_notes text, p_rights text, p_confirmed boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.community_game_curation;
  sid uuid; cid uuid; tid uuid; did uuid;
  label text; round_item jsonb; position_index integer := 0;
BEGIN
  IF NOT public.is_app_manager_user(p_reviewer) THEN RAISE EXCEPTION 'Área restrita ao AppManager'; END IF;
  SELECT * INTO c FROM public.community_game_curation WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'pending' OR c.version <> p_version THEN
    RAISE EXCEPTION 'Revisão alterada; atualize a lista';
  END IF;
  IF p_decision NOT IN ('save', 'approve', 'reject') OR length(trim(p_notes)) = 0 OR length(trim(p_rights)) = 0 THEN
    RAISE EXCEPTION 'Informe revisão e origem/direitos';
  END IF;
  FOREACH label IN ARRAY ARRAY['title', 'subject', 'chapter', 'topic', 'language'] LOOP
    IF length(trim(COALESCE(p_draft->>label, ''))) = 0 THEN RAISE EXCEPTION 'Campo obrigatório: %', label; END IF;
  END LOOP;
  IF jsonb_typeof(p_draft->'rounds') <> 'array' OR jsonb_array_length(p_draft->'rounds') NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'O game precisa de 1 a 12 rodadas';
  END IF;
  FOR round_item IN SELECT * FROM jsonb_array_elements(p_draft->'rounds') LOOP
    IF jsonb_typeof(round_item->'pairs') <> 'array' OR jsonb_array_length(round_item->'pairs') NOT BETWEEN 3 AND 5 THEN
      RAISE EXCEPTION 'Cada rodada precisa de 3 a 5 pares';
    END IF;
  END LOOP;
  IF p_decision = 'approve' AND (NOT c.eligible OR NOT COALESCE(p_confirmed, false)) THEN
    RAISE EXCEPTION 'Aprovação requer elegibilidade e direitos comerciais confirmados';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('curation:' || p_reviewer::text));
  IF p_decision = 'approve' THEN
    SELECT id INTO sid FROM public.subjects
      WHERE user_id = p_reviewer AND lower(name) = lower(trim(p_draft->>'subject')) AND language = p_draft->>'language'
      ORDER BY created_at LIMIT 1;
    IF sid IS NULL THEN
      INSERT INTO public.subjects (user_id, name, color, language)
        VALUES (p_reviewer, trim(p_draft->>'subject'), '#3b82f6', p_draft->>'language') RETURNING id INTO sid;
    END IF;
    SELECT id INTO cid FROM public.topics
      WHERE user_id = p_reviewer AND subject_id = sid AND parent_id IS NULL AND lower(name) = lower(trim(p_draft->>'chapter'))
      ORDER BY created_at LIMIT 1;
    IF cid IS NULL THEN
      INSERT INTO public.topics (user_id, subject_id, name) VALUES (p_reviewer, sid, trim(p_draft->>'chapter')) RETURNING id INTO cid;
    END IF;
    SELECT id INTO tid FROM public.topics
      WHERE user_id = p_reviewer AND subject_id = sid AND parent_id = cid AND lower(name) = lower(trim(p_draft->>'topic'))
      ORDER BY created_at LIMIT 1;
    IF tid IS NULL THEN
      INSERT INTO public.topics (user_id, subject_id, parent_id, name)
        VALUES (p_reviewer, sid, cid, trim(p_draft->>'topic')) RETURNING id INTO tid;
    END IF;
    INSERT INTO public.game_decks (user_id, topic_id, kind, title, language, is_official)
      VALUES (p_reviewer, tid, 'match', trim(p_draft->>'title'), p_draft->>'language', true) RETURNING id INTO did;
    FOR round_item IN SELECT * FROM jsonb_array_elements(p_draft->'rounds') LOOP
      INSERT INTO public.game_rounds (deck_id, user_id, position, payload)
        VALUES (did, p_reviewer, position_index, round_item);
      position_index := position_index + 1;
    END LOOP;
  END IF;
  UPDATE public.community_game_curation SET
    title = trim(p_draft->>'title'), subject = trim(p_draft->>'subject'), chapter = trim(p_draft->>'chapter'),
    topic = trim(p_draft->>'topic'), language = p_draft->>'language', rounds = p_draft->'rounds',
    status = CASE WHEN p_decision = 'approve' THEN 'approved' WHEN p_decision = 'reject' THEN 'rejected' ELSE 'pending' END,
    version = version + 1, rights_confirmed = p_confirmed, rights_notes = p_rights, review_notes = p_notes,
    reviewed_by = p_reviewer, reviewed_at = now(), official_deck_id = did
  WHERE id = p_id;
  INSERT INTO public.community_game_curation_events (curation_id, reviewer_id, decision, version, review_notes, rights_notes, snapshot)
    VALUES (p_id, p_reviewer, p_decision, p_version + 1, p_notes, p_rights, p_draft);
  RETURN did;
END $$;
REVOKE ALL ON FUNCTION public.review_game_curation(uuid, integer, uuid, text, jsonb, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_game_curation(uuid, integer, uuid, text, jsonb, text, text, boolean) TO service_role;
