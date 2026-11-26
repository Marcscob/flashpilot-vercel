ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS image_pins jsonb,
  ADD COLUMN IF NOT EXISTS image_focus integer;

CREATE OR REPLACE FUNCTION public.save_flashcards_atomically(
  p_user_id uuid,
  p_action_id uuid,
  p_cards jsonb,
  p_environment text
)
RETURNS TABLE (
  inserted_count integer,
  balance_after numeric,
  was_existing boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.flashcard_save_receipts%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_hold public.ai_flashcoin_holds%ROWTYPE;
  v_quota record;
  v_total integer;
  v_generated_count integer;
  v_generated_job_count integer;
  v_locked_job_count integer;
  v_generated_for_action integer;
  v_current_count bigint;
  v_source_action_id uuid;
  v_is_app_manager boolean := false;
  v_is_pro boolean := false;
  v_balance numeric(14, 2);
  v_hash text;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL
     OR p_environment IS NULL
     OR p_environment NOT IN ('sandbox', 'live')
     OR p_cards IS NULL
     OR (CASE
       WHEN jsonb_typeof(p_cards) = 'array'
         THEN jsonb_array_length(p_cards) NOT BETWEEN 1 AND 2500
       ELSE true
     END) THEN
    RAISE EXCEPTION 'Invalid flashcard save request' USING ERRCODE = '22023';
  END IF;

  v_total := jsonb_array_length(p_cards);
  v_hash := md5(p_cards::text);

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  SELECT * INTO v_existing
  FROM public.flashcard_save_receipts
  WHERE user_id = p_user_id AND action_id = p_action_id;
  IF FOUND THEN
    IF v_existing.payload_hash <> v_hash THEN
      RAISE EXCEPTION 'Flashcard save action was reused with different content'
        USING ERRCODE = '22023';
    END IF;
    RETURN QUERY SELECT v_existing.inserted_count, v_existing.balance_after, true;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cards) AS card(
      question text,
      answer text,
      question_original text,
      answer_original text,
      card_format text,
      topic_id uuid,
      linked_note_id uuid,
      image_category_id uuid,
      image_url text,
      image_pins jsonb,
      image_focus integer,
      video_url_1 text,
      video_url_2 text,
      generated_job_id uuid,
      generated_output_id uuid
    )
    WHERE NULLIF(BTRIM(card.question), '') IS NULL
       OR NULLIF(BTRIM(card.answer), '') IS NULL
       OR (card.generated_job_id IS NULL) <> (card.generated_output_id IS NULL)
       OR card.topic_id IS NULL
       OR length(card.question) > 20000
       OR length(card.answer) > 40000
       OR length(COALESCE(card.question_original, '')) > 20000
       OR length(COALESCE(card.answer_original, '')) > 40000
       OR length(COALESCE(card.card_format, 'plain')) > 40
       OR length(COALESCE(card.image_url, '')) > 2048
       OR length(COALESCE(card.video_url_1, '')) > 2048
       OR length(COALESCE(card.video_url_2, '')) > 2048
       OR (card.image_pins IS NOT NULL AND (
            jsonb_typeof(card.image_pins) <> 'array'
            OR jsonb_array_length(card.image_pins) > 30
            OR jsonb_array_length(card.image_pins) < 1
          ))
       OR (card.image_focus IS NOT NULL AND card.image_focus NOT BETWEEN 1 AND 30)
  ) THEN
    RAISE EXCEPTION 'Flashcard content is invalid' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cards) AS card(topic_id uuid)
    LEFT JOIN public.topics topic
      ON topic.id = card.topic_id AND topic.user_id = p_user_id
    WHERE topic.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Flashcard topic does not belong to this account' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cards) AS card(linked_note_id uuid)
    LEFT JOIN public.notes note
      ON note.id = card.linked_note_id AND note.user_id = p_user_id
    WHERE card.linked_note_id IS NOT NULL AND note.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Linked note does not belong to this account' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cards) AS card(image_category_id uuid)
    LEFT JOIN public.note_categories category
      ON category.id = card.image_category_id AND category.user_id = p_user_id
    WHERE card.image_category_id IS NOT NULL AND category.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Image category does not belong to this account' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT generated_job_id
      FROM jsonb_to_recordset(p_cards) AS card(generated_job_id uuid)
      WHERE generated_job_id IS NOT NULL
    ) jobs
    WHERE NOT EXISTS (
      SELECT 1 FROM public.ai_quota_reservations reservation
      WHERE reservation.user_id = p_user_id
        AND reservation.job_id = jobs.generated_job_id
        AND reservation.resource = 'flashcards_job'
        AND reservation.status = 'consumed'
    )
  ) THEN
    RAISE EXCEPTION 'Generated cards are not linked to a completed authorized job'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cards) AS card(
      question text,
      answer text,
      generated_job_id uuid,
      generated_output_id uuid
    )
    LEFT JOIN public.ai_generated_flashcard_outputs output
      ON output.output_id = card.generated_output_id
     AND output.user_id = p_user_id
     AND output.job_id = card.generated_job_id
     AND output.saved_action_id IS NULL
    WHERE card.generated_output_id IS NOT NULL
      AND output.output_id IS NULL
  ) OR (
    SELECT COUNT(DISTINCT card.generated_output_id)
    FROM jsonb_to_recordset(p_cards) AS card(
      generated_job_id uuid,
      generated_output_id uuid
    )
    WHERE card.generated_output_id IS NOT NULL
  ) <> (
    SELECT COUNT(*)
    FROM jsonb_to_recordset(p_cards) AS card(generated_output_id uuid)
    WHERE card.generated_output_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Generated flashcard output is invalid or already saved'
      USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(DISTINCT card.generated_job_id) INTO v_generated_job_count
  FROM jsonb_to_recordset(p_cards) AS card(
    generated_job_id uuid,
    generated_output_id uuid
  )
  WHERE card.generated_job_id IS NOT NULL
    AND card.generated_output_id IS NOT NULL;

  PERFORM job.id
  FROM public.document_jobs AS job
  JOIN (
    SELECT DISTINCT card.generated_job_id AS job_id
    FROM jsonb_to_recordset(p_cards) AS card(
      generated_job_id uuid,
      generated_output_id uuid
    )
    WHERE card.generated_job_id IS NOT NULL
      AND card.generated_output_id IS NOT NULL
  ) AS requested_job ON requested_job.job_id = job.id
  WHERE job.user_id = p_user_id
    AND job.dismissed = false
    AND job.expires_at > clock_timestamp()
  FOR KEY SHARE OF job;
  GET DIAGNOSTICS v_locked_job_count = ROW_COUNT;

  IF v_locked_job_count <> v_generated_job_count THEN
    RAISE EXCEPTION 'Generated flashcard job is missing, expired, or discarded'
      USING ERRCODE = '42501';
  END IF;

  SELECT public.is_app_manager_user(p_user_id) INTO v_is_app_manager;

  IF NOT v_is_app_manager THEN
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = p_user_id
        AND environment = p_environment
        AND status IN ('active', 'trialing', 'past_due', 'canceled')
        AND current_period_start <= now()
        AND current_period_end > now()
    ) INTO v_is_pro;
  ELSE
    v_is_pro := true;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;
  v_balance := v_profile.flashcoins_balance;

  SELECT COUNT(*) INTO v_generated_count
  FROM jsonb_to_recordset(p_cards) AS card(generated_output_id uuid)
  WHERE card.generated_output_id IS NOT NULL;

  IF v_generated_count > 0 AND NOT v_is_pro THEN
    FOR v_source_action_id IN
      SELECT DISTINCT output.action_id
      FROM public.ai_generated_flashcard_outputs output
      JOIN jsonb_to_recordset(p_cards) AS card(generated_output_id uuid)
        ON output.output_id = card.generated_output_id
      ORDER BY output.action_id
    LOOP
      SELECT * INTO v_hold
      FROM public.ai_flashcoin_holds
      WHERE user_id = p_user_id
        AND action_id = v_source_action_id
        AND status = 'reserved'
        AND expires_at > now()
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Generated flashcard coin hold is missing or expired'
          USING ERRCODE = 'P0001';
      END IF;

      SELECT COUNT(*) INTO v_generated_for_action
      FROM public.ai_generated_flashcard_outputs output
      JOIN jsonb_to_recordset(p_cards) AS card(generated_output_id uuid)
        ON output.output_id = card.generated_output_id
      WHERE output.user_id = p_user_id
        AND output.action_id = v_source_action_id;
      IF v_hold.amount < v_generated_for_action THEN
        RAISE EXCEPTION 'Generated flashcard coin hold is insufficient'
          USING ERRCODE = 'P0001';
      END IF;

      UPDATE public.profiles
      SET flashcoins_balance = flashcoins_balance - v_generated_for_action
      WHERE user_id = p_user_id
      RETURNING flashcoins_balance INTO v_balance;

      INSERT INTO public.flashcoin_ledger (
        user_id, amount, balance_after, reason, action_id
      )
      VALUES (
        p_user_id,
        -v_generated_for_action,
        v_balance,
        'ai_flashcards',
        'flashcards-save:' || p_action_id::text || ':' || v_source_action_id::text
      );

      UPDATE public.ai_flashcoin_holds
      SET amount = amount - v_generated_for_action,
          status = CASE WHEN amount = v_generated_for_action THEN 'consumed' ELSE 'reserved' END,
          settled_at = CASE WHEN amount = v_generated_for_action THEN now() ELSE NULL END
      WHERE user_id = p_user_id
        AND action_id = v_source_action_id;
    END LOOP;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.flashcards
  WHERE user_id = p_user_id AND source_id IS NULL;
  IF NOT v_is_pro AND v_current_count + v_total > 100 THEN
    RAISE EXCEPTION 'Free flashcard collection limit exceeded' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.flashcards (
    user_id,
    topic_id,
    question,
    answer,
    question_original,
    answer_original,
    card_format,
    reviewed,
    order_index,
    language,
    linked_note_id,
    image_url,
    image_category_id,
    image_pins,
    image_focus,
    video_url_1,
    video_url_2
  )
  SELECT
    p_user_id,
    card.topic_id,
    BTRIM(card.question),
    BTRIM(card.answer),
    card.question_original,
    card.answer_original,
    COALESCE(card.card_format, 'plain'),
    COALESCE(card.reviewed, false),
    card.order_index,
    card.language,
    card.linked_note_id,
    card.image_url,
    card.image_category_id,
    card.image_pins,
    card.image_focus,
    card.video_url_1,
    card.video_url_2
  FROM jsonb_to_recordset(p_cards) AS card(
    topic_id uuid,
    question text,
    answer text,
    question_original text,
    answer_original text,
    card_format text,
    reviewed boolean,
    order_index integer,
    language text,
    linked_note_id uuid,
    image_url text,
    image_category_id uuid,
    image_pins jsonb,
    image_focus integer,
    video_url_1 text,
    video_url_2 text,
    generated_job_id uuid,
    generated_output_id uuid
  );

  UPDATE public.ai_generated_flashcard_outputs output
  SET saved_action_id = p_action_id,
      saved_at = now()
  FROM jsonb_to_recordset(p_cards) AS card(generated_output_id uuid)
  WHERE output.output_id = card.generated_output_id
    AND card.generated_output_id IS NOT NULL
    AND output.user_id = p_user_id
    AND output.saved_action_id IS NULL;

  WITH saved_job_ids AS (
    SELECT DISTINCT card.generated_job_id AS job_id
    FROM jsonb_to_recordset(p_cards) AS card(
      generated_job_id uuid,
      generated_output_id uuid
    )
    WHERE card.generated_job_id IS NOT NULL
      AND card.generated_output_id IS NOT NULL
  ),
  remaining_cards AS (
    SELECT job.id,
      COALESCE(
        jsonb_agg(card.value ORDER BY card.ordinality)
          FILTER (
            WHERE card.value IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM jsonb_to_recordset(p_cards) AS saved(generated_output_id uuid)
                WHERE saved.generated_output_id::text = (card.value ->> 'generatedOutputId')
              )
          ),
        '[]'::jsonb
      ) AS cards
    FROM public.document_jobs job
    JOIN saved_job_ids saved_job ON saved_job.job_id = job.id
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(job.result_cards, '[]'::jsonb))
      WITH ORDINALITY AS card(value, ordinality) ON true
    WHERE job.user_id = p_user_id
    GROUP BY job.id
  )
  UPDATE public.document_jobs job
  SET result_cards = remaining_cards.cards,
      cards_count = jsonb_array_length(remaining_cards.cards),
      updated_at = now()
  FROM remaining_cards
  WHERE job.id = remaining_cards.id
    AND job.user_id = p_user_id;

  INSERT INTO public.flashcard_save_receipts (
    user_id, action_id, payload_hash, inserted_count, balance_after
  )
  VALUES (p_user_id, p_action_id, v_hash, v_total, v_balance);

  RETURN QUERY SELECT v_total, v_balance, false;
END;
$$;

REVOKE ALL ON FUNCTION public.save_flashcards_atomically(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_flashcards_atomically(uuid, uuid, jsonb, text)
  TO service_role;