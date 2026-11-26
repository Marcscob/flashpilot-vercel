CREATE OR REPLACE FUNCTION public.release_generated_flashcard_billing_for_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_billing public.ai_generated_flashcard_billing_reservations%ROWTYPE;
  v_saved_included integer;
  v_has_uncertain_hold boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(OLD.user_id::text, 2));

  FOR v_billing IN
    SELECT billing.*
    FROM public.ai_generated_flashcard_billing_reservations billing
    WHERE billing.user_id = OLD.user_id
      AND billing.job_id = OLD.id
      AND billing.status IN ('reserved', 'uncertain')
    FOR UPDATE
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.ai_flashcoin_holds hold
      WHERE hold.user_id = OLD.user_id
        AND hold.action_id = v_billing.action_id
        AND hold.status = 'reserved'
        AND hold.uncertain
    ) INTO v_has_uncertain_hold;

    IF v_has_uncertain_hold OR v_billing.status = 'uncertain' THEN
      UPDATE public.ai_generated_flashcard_billing_reservations
      SET status = 'uncertain'
      WHERE id = v_billing.id;
      CONTINUE;
    END IF;

    SELECT COUNT(*) FILTER (WHERE output.saved_action_id IS NOT NULL)::integer
    INTO v_saved_included
    FROM public.ai_generated_flashcard_outputs output
    WHERE output.user_id = OLD.user_id
      AND output.action_id = v_billing.action_id
      AND output.flashcoin_cost = 0;

    UPDATE public.ai_flashcoin_holds
    SET status = 'released', amount = 0, settled_at = now()
    WHERE user_id = OLD.user_id
      AND action_id = v_billing.action_id
      AND status = 'reserved'
      AND NOT uncertain;

    IF v_billing.quota_reservation_id IS NOT NULL THEN
      UPDATE public.ai_quota_reservations
      SET units = CASE WHEN v_saved_included > 0 THEN v_saved_included ELSE units END,
          status = CASE WHEN v_saved_included > 0 THEN 'consumed' ELSE 'released' END,
          daily_counted = v_saved_included > 0,
          settled_at = now()
      WHERE id = v_billing.quota_reservation_id
        AND status = 'reserved';
    END IF;

    UPDATE public.ai_generated_flashcard_billing_reservations
    SET saved_included_units = v_saved_included,
        status = CASE WHEN v_saved_included + v_billing.saved_coin_units > 0
          THEN 'settled' ELSE 'released' END,
        settled_at = now()
    WHERE id = v_billing.id;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;