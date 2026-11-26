-- Vínculo de note_categories com subjects/topics
ALTER TABLE public.note_categories
  ADD COLUMN subject_id uuid REFERENCES public.subjects(id),
  ADD COLUMN topic_id uuid REFERENCES public.topics(id);

CREATE UNIQUE INDEX note_categories_subject_id_key ON public.note_categories(subject_id) WHERE subject_id IS NOT NULL;
CREATE UNIQUE INDEX note_categories_topic_id_key ON public.note_categories(topic_id) WHERE topic_id IS NOT NULL;
ALTER TABLE public.note_categories ADD CONSTRAINT note_categories_one_link CHECK (num_nonnulls(subject_id, topic_id) <= 1);
ALTER TABLE public.note_categories ADD COLUMN is_mirror boolean GENERATED ALWAYS AS (subject_id IS NOT NULL OR topic_id IS NOT NULL) STORED;

-- 1) Casar categorias existentes com tópicos de mesmo nome
UPDATE public.note_categories c
SET topic_id = t.id
FROM public.topics t
WHERE t.user_id = c.user_id
  AND lower(btrim(t.name)) = lower(btrim(c.name))
  AND NOT EXISTS (SELECT 1 FROM public.note_categories x WHERE x.topic_id = t.id);

-- 2) Casar com matérias de mesmo nome (se ainda não casou)
UPDATE public.note_categories c
SET subject_id = s.id
FROM public.subjects s
WHERE s.user_id = c.user_id
  AND lower(btrim(s.name)) = lower(btrim(c.name))
  AND c.topic_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.note_categories x WHERE x.subject_id = s.id);

-- 3) Criar espelhos faltantes (matérias)
INSERT INTO public.note_categories (user_id, name, subject_id)
SELECT s.user_id, s.name, s.id
FROM public.subjects s
WHERE NOT EXISTS (SELECT 1 FROM public.note_categories c WHERE c.subject_id = s.id);

-- 4) Criar espelhos faltantes (assuntos/subtópicos)
INSERT INTO public.note_categories (user_id, name, topic_id)
SELECT t.user_id, t.name, t.id
FROM public.topics t
WHERE NOT EXISTS (SELECT 1 FROM public.note_categories c WHERE c.topic_id = t.id);

-- 5) Posicionar espelhos na hierarquia: subtópico -> assunto pai -> matéria
UPDATE public.note_categories c
SET parent_id = ps.id
FROM public.topics t, public.note_categories ps
WHERE c.topic_id = t.id
  AND t.parent_id IS NOT NULL
  AND ps.topic_id = t.parent_id;

UPDATE public.note_categories c
SET parent_id = ps.id
FROM public.topics t, public.note_categories ps
WHERE c.topic_id = t.id
  AND t.parent_id IS NULL
  AND ps.subject_id = t.subject_id;

UPDATE public.note_categories c SET parent_id = NULL WHERE c.subject_id IS NOT NULL;

-- 6) Triggers de sincronização
CREATE OR REPLACE FUNCTION public.sync_note_category_subject()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.note_categories WHERE subject_id = NEW.id) THEN
      INSERT INTO public.note_categories (user_id, name, subject_id) VALUES (NEW.user_id, NEW.name, NEW.id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      UPDATE public.note_categories SET name = NEW.name WHERE subject_id = NEW.id;
    END IF;
    RETURN NEW;
  ELSE -- DELETE
    IF EXISTS (SELECT 1 FROM public.note_categories m WHERE m.subject_id = OLD.id
               AND NOT EXISTS (SELECT 1 FROM public.notes n WHERE n.category_id = m.id)
               AND NOT EXISTS (SELECT 1 FROM public.note_media mm WHERE mm.category_id = m.id)
               AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.image_category_id = m.id)
               AND NOT EXISTS (SELECT 1 FROM public.note_categories ch WHERE ch.parent_id = m.id)) THEN
      DELETE FROM public.note_categories WHERE subject_id = OLD.id;
    ELSE
      UPDATE public.note_categories SET subject_id = NULL WHERE subject_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER note_categories_sync_subject
AFTER INSERT OR UPDATE OR DELETE ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.sync_note_category_subject();

CREATE OR REPLACE FUNCTION public.sync_note_category_topic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.note_categories WHERE topic_id = NEW.id) THEN
      INSERT INTO public.note_categories (user_id, name, topic_id, parent_id)
      VALUES (
        NEW.user_id, NEW.name, NEW.id,
        COALESCE(
          (SELECT id FROM public.note_categories WHERE topic_id = NEW.parent_id),
          (SELECT id FROM public.note_categories WHERE subject_id = NEW.subject_id)
        )
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.name IS DISTINCT FROM OLD.name THEN
      UPDATE public.note_categories SET name = NEW.name WHERE topic_id = NEW.id;
    END IF;
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.subject_id IS DISTINCT FROM OLD.subject_id THEN
      UPDATE public.note_categories m
      SET parent_id = COALESCE(
        (SELECT id FROM public.note_categories WHERE topic_id = NEW.parent_id),
        (SELECT id FROM public.note_categories WHERE subject_id = NEW.subject_id)
      )
      WHERE m.topic_id = NEW.id;
    END IF;
    RETURN NEW;
  ELSE -- DELETE
    IF EXISTS (SELECT 1 FROM public.note_categories m WHERE m.topic_id = OLD.id
               AND NOT EXISTS (SELECT 1 FROM public.notes n WHERE n.category_id = m.id)
               AND NOT EXISTS (SELECT 1 FROM public.note_media mm WHERE mm.category_id = m.id)
               AND NOT EXISTS (SELECT 1 FROM public.flashcards f WHERE f.image_category_id = m.id)
               AND NOT EXISTS (SELECT 1 FROM public.note_categories ch WHERE ch.parent_id = m.id)) THEN
      DELETE FROM public.note_categories WHERE topic_id = OLD.id;
    ELSE
      UPDATE public.note_categories SET topic_id = NULL WHERE topic_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER note_categories_sync_topic
AFTER INSERT OR UPDATE OR DELETE ON public.topics
FOR EACH ROW EXECUTE FUNCTION public.sync_note_category_topic();