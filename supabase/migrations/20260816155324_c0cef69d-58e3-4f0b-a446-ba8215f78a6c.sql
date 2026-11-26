CREATE TABLE public.study_notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  mode text NOT NULL DEFAULT 'due',
  order_mode text NOT NULL DEFAULT 'alpha',
  shuffle_seed integer NOT NULL DEFAULT 1,
  current_card_id uuid,
  reviewed_card_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_studied_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_notebooks TO authenticated;
GRANT ALL ON public.study_notebooks TO service_role;
ALTER TABLE public.study_notebooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study notebooks" ON public.study_notebooks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_notebook_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.study_notebooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scope_exactly_one CHECK ((subject_id IS NOT NULL) <> (topic_id IS NOT NULL))
);
CREATE UNIQUE INDEX study_notebook_scopes_subject_uniq ON public.study_notebook_scopes (notebook_id, subject_id) WHERE subject_id IS NOT NULL;
CREATE UNIQUE INDEX study_notebook_scopes_topic_uniq ON public.study_notebook_scopes (notebook_id, topic_id) WHERE topic_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_notebook_scopes TO authenticated;
GRANT ALL ON public.study_notebook_scopes TO service_role;
ALTER TABLE public.study_notebook_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study notebook scopes" ON public.study_notebook_scopes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_notebook_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.study_notebooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notebook_id, flashcard_id)
);
CREATE INDEX study_notebook_cards_user_card_idx ON public.study_notebook_cards (user_id, flashcard_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_notebook_cards TO authenticated;
GRANT ALL ON public.study_notebook_cards TO service_role;
ALTER TABLE public.study_notebook_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own study notebook cards" ON public.study_notebook_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);