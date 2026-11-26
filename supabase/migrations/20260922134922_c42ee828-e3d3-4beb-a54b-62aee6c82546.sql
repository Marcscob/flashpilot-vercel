ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS source_id uuid, ADD COLUMN IF NOT EXISTS source_synced_at timestamptz, ADD COLUMN IF NOT EXISTS user_modified boolean NOT NULL DEFAULT false;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS source_id uuid, ADD COLUMN IF NOT EXISTS source_synced_at timestamptz, ADD COLUMN IF NOT EXISTS user_modified boolean NOT NULL DEFAULT false;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS source_id uuid, ADD COLUMN IF NOT EXISTS source_synced_at timestamptz, ADD COLUMN IF NOT EXISTS user_modified boolean NOT NULL DEFAULT false;
ALTER TABLE public.note_categories ADD COLUMN IF NOT EXISTS source_id uuid, ADD COLUMN IF NOT EXISTS source_synced_at timestamptz, ADD COLUMN IF NOT EXISTS user_modified boolean NOT NULL DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS source_id uuid, ADD COLUMN IF NOT EXISTS source_synced_at timestamptz, ADD COLUMN IF NOT EXISTS user_modified boolean NOT NULL DEFAULT false;
ALTER TABLE public.note_media ADD COLUMN IF NOT EXISTS source_id uuid, ADD COLUMN IF NOT EXISTS source_synced_at timestamptz, ADD COLUMN IF NOT EXISTS user_modified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_subjects_user_source ON public.subjects(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_topics_user_source ON public.topics(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_source ON public.flashcards(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_note_categories_user_source ON public.note_categories(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_source ON public.notes(user_id, source_id);
CREATE INDEX IF NOT EXISTS idx_note_media_user_source ON public.note_media(user_id, source_id);

CREATE TABLE IF NOT EXISTS public.subject_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  source_subject_id uuid NOT NULL,
  copy_subject_id uuid,
  renew_mode text NOT NULL DEFAULT 'keep',
  last_synced_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_subject_id)
);

GRANT SELECT, INSERT, UPDATE ON public.subject_grants TO authenticated;
GRANT ALL ON public.subject_grants TO service_role;

ALTER TABLE public.subject_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subject_grants_select_own" ON public.subject_grants FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "subject_grants_update_own" ON public.subject_grants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER subject_grants_updated_at BEFORE UPDATE ON public.subject_grants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Marca o item como "alterado pelo aluno" quando ele edita conteúdo de um item copiado.
-- A sincronização oficial sempre atualiza source_synced_at, e por isso não dispara a marca.
CREATE OR REPLACE FUNCTION public.mark_user_modified()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  excluded text[] := ARRAY[
    'updated_at','user_modified','source_synced_at','source_id',
    'due_date','ease_factor','interval_days','repetitions','last_reviewed_at',
    'reviewed','reviewed_marked_at','is_favorite','user_answer','order_index',
    'rewritten_at','is_public_verified'
  ];
  old_content jsonb;
  new_content jsonb;
  k text;
BEGIN
  IF NEW.source_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.source_synced_at IS DISTINCT FROM OLD.source_synced_at THEN RETURN NEW; END IF;
  IF NEW.user_modified THEN RETURN NEW; END IF;

  old_content := to_jsonb(OLD);
  new_content := to_jsonb(NEW);
  FOREACH k IN ARRAY excluded LOOP
    old_content := old_content - k;
    new_content := new_content - k;
  END LOOP;

  IF old_content IS DISTINCT FROM new_content THEN
    NEW.user_modified := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER flashcards_mark_user_modified BEFORE UPDATE ON public.flashcards FOR EACH ROW EXECUTE FUNCTION public.mark_user_modified();
CREATE TRIGGER notes_mark_user_modified BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.mark_user_modified();
CREATE TRIGGER note_media_mark_user_modified BEFORE UPDATE ON public.note_media FOR EACH ROW EXECUTE FUNCTION public.mark_user_modified();
CREATE TRIGGER note_categories_mark_user_modified BEFORE UPDATE ON public.note_categories FOR EACH ROW EXECUTE FUNCTION public.mark_user_modified();
CREATE TRIGGER topics_mark_user_modified BEFORE UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.mark_user_modified();
CREATE TRIGGER subjects_mark_user_modified BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.mark_user_modified();