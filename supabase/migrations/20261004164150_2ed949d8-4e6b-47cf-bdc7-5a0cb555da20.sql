DO $$
DECLARE r record; v_pos integer;
BEGIN
  FOR r IN SELECT s.id, s.user_id, s.name FROM public.subjects s
    WHERE s.order_index IS NULL
      AND EXISTS (SELECT 1 FROM public.subjects x WHERE x.user_id = s.user_id AND x.order_index IS NOT NULL)
    ORDER BY s.created_at
  LOOP
    SELECT min(order_index) INTO v_pos FROM public.subjects
     WHERE user_id = r.user_id AND order_index IS NOT NULL AND lower(name) > lower(r.name);
    IF v_pos IS NULL THEN
      SELECT coalesce(max(order_index),0)+1 INTO v_pos FROM public.subjects WHERE user_id = r.user_id;
    ELSE
      UPDATE public.subjects SET order_index = order_index + 1 WHERE user_id = r.user_id AND order_index >= v_pos;
    END IF;
    UPDATE public.subjects SET order_index = v_pos WHERE id = r.id;
  END LOOP;
END $$;