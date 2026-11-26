-- 1) Funções auxiliares (SECURITY DEFINER para não recair nas políticas das tabelas)
CREATE OR REPLACE FUNCTION public.has_subject_access(user_uuid uuid, p_subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_purchases up
    JOIN public.store_products sp ON sp.id = up.product_id
    WHERE up.user_id = user_uuid
      AND sp.access_subject_id = p_subject_id
      AND up.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_topic_access(user_uuid uuid, p_topic_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.topics t
    WHERE t.id = p_topic_id
      AND public.has_subject_access(user_uuid, t.subject_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_note_category_access(user_uuid uuid, p_category_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_categories nc
    LEFT JOIN public.topics t ON t.id = nc.topic_id
    WHERE nc.id = p_category_id
      AND (
        (nc.subject_id IS NOT NULL AND public.has_subject_access(user_uuid, nc.subject_id))
        OR (t.id IS NOT NULL AND public.has_subject_access(user_uuid, t.subject_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_note_access(user_uuid uuid, p_note_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.id = p_note_id
      AND n.category_id IS NOT NULL
      AND public.has_note_category_access(user_uuid, n.category_id)
  );
$$;

-- 2) Leitura ao vivo do conteúdo oficial comprado (somente SELECT)
CREATE POLICY "purchased subjects readable"
  ON public.subjects FOR SELECT TO authenticated
  USING (public.has_subject_access(auth.uid(), id));

CREATE POLICY "purchased topics readable"
  ON public.topics FOR SELECT TO authenticated
  USING (public.has_subject_access(auth.uid(), subject_id));

CREATE POLICY "purchased flashcards readable"
  ON public.flashcards FOR SELECT TO authenticated
  USING (public.has_topic_access(auth.uid(), topic_id));

CREATE POLICY "purchased note categories readable"
  ON public.note_categories FOR SELECT TO authenticated
  USING (public.has_note_category_access(auth.uid(), id));

CREATE POLICY "purchased notes readable"
  ON public.notes FOR SELECT TO authenticated
  USING (category_id IS NOT NULL AND public.has_note_category_access(auth.uid(), category_id));

CREATE POLICY "purchased note media readable"
  ON public.note_media FOR SELECT TO authenticated
  USING (
    (category_id IS NOT NULL AND public.has_note_category_access(auth.uid(), category_id))
    OR (note_id IS NOT NULL AND public.has_note_access(auth.uid(), note_id))
  );

-- 3) Progresso de estudo por aluno nos cards oficiais
CREATE TABLE public.official_card_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  ease_factor real NOT NULL DEFAULT 2.5,
  interval_days integer NOT NULL DEFAULT 0,
  repetitions integer NOT NULL DEFAULT 0,
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, flashcard_id)
);

CREATE INDEX idx_official_card_progress_user ON public.official_card_progress(user_id, due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_card_progress TO authenticated;
GRANT ALL ON public.official_card_progress TO service_role;

ALTER TABLE public.official_card_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own official progress"
  ON public.official_card_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER official_card_progress_updated_at
  BEFORE UPDATE ON public.official_card_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();