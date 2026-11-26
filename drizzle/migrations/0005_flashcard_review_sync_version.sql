-- Controle de versão monotônico para sincronização offline de revisões
ALTER TABLE public.flashcards ADD COLUMN revision_version bigint NOT NULL DEFAULT 0;
ALTER TABLE public.official_card_progress ADD COLUMN revision_version bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.flashcards.revision_version IS 'Versão monotônica do estado de revisão (SM-2); usada na sincronização offline em lote.';
COMMENT ON COLUMN public.official_card_progress.revision_version IS 'Versão monotônica do progresso do aluno em card oficial; usada na sincronização offline em lote.';

-- Sincronização em lote de revisões com controle otimista de concorrência:
-- o cliente envia o estado SM-2 já calculado e a versão em que se baseou
-- (base_version). Só aplicamos quando base_version >= versão atual; caso
-- contrário devolvemos "conflict" com a versão vigente para o cliente
-- recalcular. Cada aplicação incrementa revision_version em 1.
CREATE OR REPLACE FUNCTION public.sync_flashcard_reviews(p_user_id uuid, p_reviews jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  card record;
  result jsonb := '[]'::jsonb;
  v_flashcard_id uuid;
  v_quality int;
  v_base_version bigint;
  v_ease real;
  v_interval int;
  v_reps int;
  v_due date;
  v_reviewed_at timestamptz;
  v_is_own boolean;
  v_current_version bigint;
  v_has_access boolean;
BEGIN
  IF p_user_id IS NULL OR jsonb_typeof(p_reviews) <> 'array' THEN
    RETURN '[]'::jsonb;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_reviews)
  LOOP
    BEGIN
      v_flashcard_id := (item->>'flashcard_id')::uuid;
      v_quality := (item->>'quality')::int;
      v_base_version := coalesce((item->>'base_version')::bigint, 0);
      v_ease := (item->>'ease_factor')::real;
      v_interval := (item->>'interval_days')::int;
      v_reps := (item->>'repetitions')::int;
      v_due := (item->>'due_date')::date;
      v_reviewed_at := coalesce((item->>'last_reviewed_at')::timestamptz, now());

      IF v_quality IS NULL OR v_quality < 0 OR v_quality > 5
         OR v_ease IS NULL OR v_ease < 1.3
         OR v_interval IS NULL OR v_interval < 0 OR v_interval > 30
         OR v_reps IS NULL OR v_reps < 0 OR v_due IS NULL THEN
        result := result || jsonb_build_object('flashcard_id', v_flashcard_id, 'status', 'invalid');
        CONTINUE;
      END IF;

      SELECT f.id, f.user_id, f.revision_version INTO card
      FROM public.flashcards f WHERE f.id = v_flashcard_id;

      IF NOT FOUND THEN
        result := result || jsonb_build_object('flashcard_id', v_flashcard_id, 'status', 'not_found');
        CONTINUE;
      END IF;

      v_is_own := card.user_id = p_user_id;

      IF v_is_own THEN
        v_current_version := card.revision_version;
      ELSE
        -- Card oficial: exige acesso à matéria e versiona o progresso do aluno
        SELECT coalesce(p.revision_version, 0) INTO v_current_version
        FROM public.official_card_progress p
        WHERE p.user_id = p_user_id AND p.flashcard_id = v_flashcard_id;
        v_current_version := coalesce(v_current_version, 0);

        SELECT public.has_subject_access(p_user_id, t.subject_id) INTO v_has_access
        FROM public.flashcards f
        JOIN public.topics t ON t.id = f.topic_id
        WHERE f.id = v_flashcard_id;

        IF NOT coalesce(v_has_access, false) THEN
          result := result || jsonb_build_object('flashcard_id', v_flashcard_id, 'status', 'forbidden');
          CONTINUE;
        END IF;
      END IF;

      -- Controle monotônico: só aplica se o cliente partiu da versão atual
      IF v_base_version < v_current_version THEN
        result := result || jsonb_build_object(
          'flashcard_id', v_flashcard_id,
          'status', 'conflict',
          'revision_version', v_current_version
        );
        CONTINUE;
      END IF;

      IF v_is_own THEN
        UPDATE public.flashcards SET
          ease_factor = v_ease,
          interval_days = v_interval,
          repetitions = v_reps,
          due_date = v_due,
          last_reviewed_at = v_reviewed_at,
          revision_version = revision_version + 1
        WHERE id = v_flashcard_id AND user_id = p_user_id;
      ELSE
        INSERT INTO public.official_card_progress
          (user_id, flashcard_id, ease_factor, interval_days, repetitions, due_date, last_reviewed_at, revision_version, updated_at)
        VALUES
          (p_user_id, v_flashcard_id, v_ease, v_interval, v_reps, v_due, v_reviewed_at, 1, now())
        ON CONFLICT (user_id, flashcard_id) DO UPDATE SET
          ease_factor = excluded.ease_factor,
          interval_days = excluded.interval_days,
          repetitions = excluded.repetitions,
          due_date = excluded.due_date,
          last_reviewed_at = excluded.last_reviewed_at,
          revision_version = public.official_card_progress.revision_version + 1,
          updated_at = now();
      END IF;

      INSERT INTO public.flashcard_reviews
        (user_id, flashcard_id, quality, next_due_date, interval_days, ease_factor, repetitions, reviewed_at)
      VALUES
        (p_user_id, v_flashcard_id, v_quality, v_due, v_interval, v_ease, v_reps, v_reviewed_at);

      result := result || jsonb_build_object(
        'flashcard_id', v_flashcard_id,
        'status', 'applied',
        'revision_version', v_current_version + 1
      );
    EXCEPTION WHEN OTHERS THEN
      result := result || jsonb_build_object(
        'flashcard_id', item->>'flashcard_id',
        'status', 'error',
        'message', sqlerrm
      );
    END;
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_flashcard_reviews(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_flashcard_reviews(uuid, jsonb) TO authenticated;