ALTER TABLE public.note_categories DROP CONSTRAINT note_categories_subject_id_fkey;
ALTER TABLE public.note_categories ADD CONSTRAINT note_categories_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;

ALTER TABLE public.note_categories DROP CONSTRAINT note_categories_topic_id_fkey;
ALTER TABLE public.note_categories ADD CONSTRAINT note_categories_topic_id_fkey
  FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS note_categories_sync_subject ON public.subjects;
CREATE TRIGGER note_categories_sync_subject
  AFTER INSERT OR UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.sync_note_category_subject();
CREATE TRIGGER note_categories_sync_subject_del
  BEFORE DELETE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.sync_note_category_subject();

DROP TRIGGER IF EXISTS note_categories_sync_topic ON public.topics;
CREATE TRIGGER note_categories_sync_topic
  AFTER INSERT OR UPDATE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.sync_note_category_topic();
CREATE TRIGGER note_categories_sync_topic_del
  BEFORE DELETE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.sync_note_category_topic();