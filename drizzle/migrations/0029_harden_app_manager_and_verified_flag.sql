CREATE OR REPLACE FUNCTION public.is_app_manager()
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_app_manager', 'false') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.protect_flashcard_verified_flag()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_public_verified := false;
    ELSIF NEW.is_public_verified IS DISTINCT FROM OLD.is_public_verified THEN
      NEW.is_public_verified := OLD.is_public_verified;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS flashcards_protect_verified_flag ON public.flashcards;
CREATE TRIGGER flashcards_protect_verified_flag
BEFORE INSERT OR UPDATE ON public.flashcards
FOR EACH ROW EXECUTE FUNCTION public.protect_flashcard_verified_flag();