CREATE OR REPLACE FUNCTION public.protect_purchased_content_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.source_id IS NULL THEN
    RETURN OLD;
  END IF;
  IF auth.role() = 'service_role' THEN
    RETURN OLD;
  END IF;
  IF lower(COALESCE(auth.jwt() ->> 'email', '')) = 'guit1966@gmail.com' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Conteúdo de matéria comprada não pode ser excluído.';
END;
$$;

CREATE TRIGGER subjects_protect_purchased_delete
  BEFORE DELETE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.protect_purchased_content_delete();

CREATE TRIGGER topics_protect_purchased_delete
  BEFORE DELETE ON public.topics
  FOR EACH ROW EXECUTE FUNCTION public.protect_purchased_content_delete();

CREATE TRIGGER flashcards_protect_purchased_delete
  BEFORE DELETE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.protect_purchased_content_delete();

CREATE TRIGGER notes_protect_purchased_delete
  BEFORE DELETE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.protect_purchased_content_delete();

CREATE TRIGGER note_media_protect_purchased_delete
  BEFORE DELETE ON public.note_media
  FOR EACH ROW EXECUTE FUNCTION public.protect_purchased_content_delete();

CREATE TRIGGER note_categories_protect_purchased_delete
  BEFORE DELETE ON public.note_categories
  FOR EACH ROW EXECUTE FUNCTION public.protect_purchased_content_delete();