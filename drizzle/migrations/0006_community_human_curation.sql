CREATE TABLE public.community_curation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_card_id uuid NOT NULL UNIQUE,
 source_question text NOT NULL, source_answer text NOT NULL,
 question text NOT NULL, answer text NOT NULL,
 subject text NOT NULL, chapter text NOT NULL, topic text NOT NULL, language text NOT NULL DEFAULT 'pt', reference text NOT NULL DEFAULT '',
 eligible boolean NOT NULL DEFAULT false, risk text NOT NULL DEFAULT 'rights_uncertain', audit_reason text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
 version integer NOT NULL DEFAULT 1, rights_confirmed boolean NOT NULL DEFAULT false, rights_notes text NOT NULL DEFAULT '', review_notes text NOT NULL DEFAULT '',
 reviewed_by uuid, reviewed_at timestamptz, official_card_id uuid UNIQUE REFERENCES public.flashcards(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_curation TO authenticated;
GRANT ALL ON public.community_curation TO service_role;
ALTER TABLE public.community_curation ENABLE ROW LEVEL SECURITY;
CREATE POLICY manager_read_curation ON public.community_curation FOR SELECT TO authenticated USING (public.is_app_manager());
CREATE INDEX community_curation_status_idx ON public.community_curation(status, created_at);
CREATE TABLE public.community_curation_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), curation_id uuid NOT NULL REFERENCES public.community_curation(id), reviewer_id uuid NOT NULL,
 decision text NOT NULL, version integer NOT NULL, review_notes text NOT NULL, rights_notes text NOT NULL, snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_curation_events TO authenticated;
GRANT ALL ON public.community_curation_events TO service_role;
ALTER TABLE public.community_curation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY manager_read_curation_events ON public.community_curation_events FOR SELECT TO authenticated USING (public.is_app_manager());
CREATE OR REPLACE FUNCTION public.review_community_curation(p_id uuid, p_version integer, p_reviewer uuid, p_decision text, p_draft jsonb, p_notes text, p_rights text, p_confirmed boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.community_curation; sid uuid; cid uuid; tid uuid; fid uuid; label text;
BEGIN
 IF NOT public.is_app_manager_user(p_reviewer) THEN RAISE EXCEPTION 'Área restrita ao AppManager'; END IF;
 SELECT * INTO c FROM public.community_curation WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.status <> 'pending' OR c.version <> p_version THEN RAISE EXCEPTION 'Revisão alterada; atualize a lista'; END IF;
 IF p_decision NOT IN ('save','approve','reject') OR length(trim(p_notes))=0 OR length(trim(p_rights))=0 THEN RAISE EXCEPTION 'Informe revisão e origem/direitos'; END IF;
 FOREACH label IN ARRAY ARRAY['question','answer','subject','chapter','topic','language'] LOOP
  IF length(trim(COALESCE(p_draft->>label,'')))=0 THEN RAISE EXCEPTION 'Campo obrigatório: %',label; END IF;
 END LOOP;
 IF p_decision='approve' AND (NOT c.eligible OR NOT COALESCE(p_confirmed,false)) THEN RAISE EXCEPTION 'Aprovação requer elegibilidade e direitos comerciais confirmados'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('curation:' || p_reviewer::text));
 IF p_decision='approve' THEN
  SELECT id INTO sid FROM public.subjects WHERE user_id=p_reviewer AND lower(name)=lower(trim(p_draft->>'subject')) AND language=p_draft->>'language' ORDER BY created_at LIMIT 1;
  IF sid IS NULL THEN
   INSERT INTO public.subjects(user_id,name,color,language) VALUES(p_reviewer,trim(p_draft->>'subject'),'#3b82f6',p_draft->>'language') RETURNING id INTO sid;
  END IF;
  SELECT id INTO cid FROM public.topics WHERE user_id=p_reviewer AND subject_id=sid AND parent_id IS NULL AND lower(name)=lower(trim(p_draft->>'chapter')) ORDER BY created_at LIMIT 1;
  IF cid IS NULL THEN INSERT INTO public.topics(user_id,subject_id,name) VALUES(p_reviewer,sid,trim(p_draft->>'chapter')) RETURNING id INTO cid; END IF;
  SELECT id INTO tid FROM public.topics WHERE user_id=p_reviewer AND subject_id=sid AND parent_id=cid AND lower(name)=lower(trim(p_draft->>'topic')) ORDER BY created_at LIMIT 1;
  IF tid IS NULL THEN INSERT INTO public.topics(user_id,subject_id,parent_id,name) VALUES(p_reviewer,sid,cid,trim(p_draft->>'topic')) RETURNING id INTO tid; END IF;
  INSERT INTO public.flashcards(user_id,topic_id,question,answer,language,is_public_verified)
  VALUES(p_reviewer,tid,p_draft->>'question',p_draft->>'answer' || CASE WHEN length(trim(COALESCE(p_draft->>'reference','')))>0 THEN E'\n\nReferência: ' || trim(p_draft->>'reference') ELSE '' END,p_draft->>'language',true) RETURNING id INTO fid;
 END IF;
 UPDATE public.community_curation SET question=p_draft->>'question', answer=p_draft->>'answer', subject=trim(p_draft->>'subject'), chapter=trim(p_draft->>'chapter'), topic=trim(p_draft->>'topic'), language=p_draft->>'language', reference=COALESCE(p_draft->>'reference',''),
 status=CASE WHEN p_decision='approve' THEN 'approved' WHEN p_decision='reject' THEN 'rejected' ELSE 'pending' END,
 version=version+1, rights_confirmed=p_confirmed, rights_notes=p_rights, review_notes=p_notes, reviewed_by=p_reviewer, reviewed_at=now(), official_card_id=fid WHERE id=p_id;
 INSERT INTO public.community_curation_events(curation_id,reviewer_id,decision,version,review_notes,rights_notes,snapshot) VALUES(p_id,p_reviewer,p_decision,p_version+1,p_notes,p_rights,p_draft);
 RETURN fid;
END $$;
REVOKE ALL ON FUNCTION public.review_community_curation(uuid,integer,uuid,text,jsonb,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_community_curation(uuid,integer,uuid,text,jsonb,text,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.protect_curated_official_card() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (NEW.question,NEW.answer,NEW.topic_id) IS DISTINCT FROM (OLD.question,OLD.answer,OLD.topic_id)
 AND EXISTS(SELECT 1 FROM public.community_curation WHERE official_card_id=OLD.id AND status='approved') THEN
  RAISE EXCEPTION 'Material curado aprovado não pode ser alterado fora da revisão humana';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_curated_official_card() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_curated_official_card BEFORE UPDATE ON public.flashcards FOR EACH ROW EXECUTE FUNCTION public.protect_curated_official_card();