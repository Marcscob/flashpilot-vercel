CREATE OR REPLACE FUNCTION public.place_new_subject_alphabetically()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pos integer;
BEGIN
  IF NEW.order_index IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM subjects WHERE user_id = NEW.user_id AND order_index IS NOT NULL) THEN
    RETURN NEW;
  END IF;
  SELECT min(order_index) INTO v_pos FROM subjects
   WHERE user_id = NEW.user_id AND order_index IS NOT NULL
     AND lower(name) > lower(NEW.name);
  IF v_pos IS NULL THEN
    SELECT coalesce(max(order_index), 0) + 1 INTO v_pos FROM subjects WHERE user_id = NEW.user_id;
  ELSE
    UPDATE subjects SET order_index = order_index + 1
     WHERE user_id = NEW.user_id AND order_index >= v_pos;
  END IF;
  NEW.order_index := v_pos;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.place_new_subject_alphabetically() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS place_new_subject_alphabetically ON public.subjects;
CREATE TRIGGER place_new_subject_alphabetically BEFORE INSERT ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.place_new_subject_alphabetically();
-- Fix subjects already placed at the end with no position
UPDATE public.subjects s SET order_index = NULL WHERE false;