CREATE OR REPLACE FUNCTION public.link_note_category_to_official(
  p_category_id uuid,
  p_subject_id uuid DEFAULT NULL,
  p_topic_id uuid DEFAULT NULL
)
RETURNS public.note_categories
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_category public.note_categories%ROWTYPE;
  v_existing public.note_categories%ROWTYPE;
  v_parent_category_id uuid;
  v_official_name text;
  v_target_topic_id uuid;
  v_subject_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF num_nonnulls(p_subject_id, p_topic_id) <> 1 THEN
    RAISE EXCEPTION 'Choose exactly one subject or topic';
  END IF;

  SELECT * INTO v_category
  FROM public.note_categories
  WHERE id = p_category_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF p_subject_id IS NOT NULL THEN
    SELECT s.name, s.id INTO v_official_name, v_subject_id
    FROM public.subjects s
    WHERE s.id = p_subject_id AND s.user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subject not found';
    END IF;

    v_parent_category_id := NULL;

    SELECT t.id INTO v_target_topic_id
    FROM public.topics t
    WHERE t.user_id = v_user_id
      AND t.subject_id = v_subject_id
      AND t.parent_id IS NULL
      AND lower(t.name) = lower('Geral')
    ORDER BY t.created_at
    LIMIT 1;

    IF v_target_topic_id IS NULL THEN
      INSERT INTO public.topics (user_id, subject_id, name, parent_id)
      VALUES (v_user_id, v_subject_id, 'Geral', NULL)
      RETURNING id INTO v_target_topic_id;
    END IF;
  ELSE
    SELECT t.name, t.subject_id INTO v_official_name, v_subject_id
    FROM public.topics t
    WHERE t.id = p_topic_id AND t.user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Topic not found';
    END IF;

    v_target_topic_id := p_topic_id;

    SELECT nc.id INTO v_parent_category_id
    FROM public.topics t
    JOIN public.note_categories nc
      ON nc.user_id = v_user_id
     AND (
       (t.parent_id IS NOT NULL AND nc.topic_id = t.parent_id)
       OR
       (t.parent_id IS NULL AND nc.subject_id = t.subject_id)
     )
    WHERE t.id = p_topic_id
    ORDER BY CASE WHEN t.parent_id IS NOT NULL AND nc.topic_id = t.parent_id THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  SELECT * INTO v_existing
  FROM public.note_categories nc
  WHERE nc.user_id = v_user_id
    AND nc.id <> p_category_id
    AND (
      (p_subject_id IS NOT NULL AND nc.subject_id = p_subject_id)
      OR
      (p_topic_id IS NOT NULL AND nc.topic_id = p_topic_id)
    )
  FOR UPDATE;

  UPDATE public.note_categories
  SET parent_id = NULL
  WHERE id = p_category_id;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.notes
    SET category_id = p_category_id
    WHERE user_id = v_user_id AND category_id = v_existing.id;

    UPDATE public.note_media
    SET category_id = p_category_id
    WHERE user_id = v_user_id AND category_id = v_existing.id;

    UPDATE public.flashcards
    SET image_category_id = p_category_id
    WHERE user_id = v_user_id AND image_category_id = v_existing.id;

    UPDATE public.note_categories
    SET parent_id = p_category_id
    WHERE user_id = v_user_id
      AND parent_id = v_existing.id
      AND id <> p_category_id;

    DELETE FROM public.note_categories
    WHERE id = v_existing.id AND user_id = v_user_id;
  END IF;

  UPDATE public.note_categories
  SET subject_id = p_subject_id,
      topic_id = p_topic_id,
      name = v_official_name,
      parent_id = v_parent_category_id
  WHERE id = p_category_id
  RETURNING * INTO v_category;

  UPDATE public.flashcards f
  SET topic_id = v_target_topic_id
  WHERE f.user_id = v_user_id
    AND (
      f.image_category_id = p_category_id
      OR EXISTS (
        SELECT 1 FROM public.notes n
        WHERE n.id = f.linked_note_id
          AND n.user_id = v_user_id
          AND n.category_id = p_category_id
      )
    );

  RETURN v_category;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_note_category_to_official(uuid, uuid, uuid) TO service_role;