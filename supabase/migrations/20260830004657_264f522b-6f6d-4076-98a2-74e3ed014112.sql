CREATE OR REPLACE FUNCTION public.sync_note_category_flashcards(p_category_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_category public.note_categories%ROWTYPE;
  v_target_topic_id uuid;
  v_updated integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_category
  FROM public.note_categories
  WHERE id = p_category_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF num_nonnulls(v_category.subject_id, v_category.topic_id) <> 1 THEN
    RAISE EXCEPTION 'Category is not linked to an official subject or topic';
  END IF;

  IF v_category.topic_id IS NOT NULL THEN
    -- Categoria espelha um assunto/subtópico: alvo exato.
    v_target_topic_id := v_category.topic_id;

    UPDATE public.flashcards f
    SET topic_id = v_target_topic_id
    WHERE f.user_id = v_user_id
      AND f.topic_id IS DISTINCT FROM v_target_topic_id
      AND (
        f.image_category_id = p_category_id
        OR EXISTS (
          SELECT 1 FROM public.notes n
          WHERE n.id = f.linked_note_id AND n.user_id = v_user_id AND n.category_id = p_category_id
        )
      );

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
  END IF;

  -- Categoria espelha uma matéria: só realoca cards que estão FORA da matéria.
  SELECT t.id INTO v_target_topic_id
  FROM public.topics t
  WHERE t.user_id = v_user_id
    AND t.subject_id = v_category.subject_id
    AND t.parent_id IS NULL
    AND lower(t.name) = lower('Geral')
  ORDER BY t.created_at
  LIMIT 1;

  IF v_target_topic_id IS NULL THEN
    INSERT INTO public.topics (user_id, subject_id, name, parent_id)
    VALUES (v_user_id, v_category.subject_id, 'Geral', NULL)
    RETURNING id INTO v_target_topic_id;
  END IF;

  UPDATE public.flashcards f
  SET topic_id = v_target_topic_id
  WHERE f.user_id = v_user_id
    AND f.topic_id IS DISTINCT FROM v_target_topic_id
    AND NOT EXISTS (
      SELECT 1 FROM public.topics t
      WHERE t.id = f.topic_id AND t.subject_id = v_category.subject_id
    )
    AND (
      f.image_category_id = p_category_id
      OR EXISTS (
        SELECT 1 FROM public.notes n
        WHERE n.id = f.linked_note_id AND n.user_id = v_user_id AND n.category_id = p_category_id
      )
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$function$;