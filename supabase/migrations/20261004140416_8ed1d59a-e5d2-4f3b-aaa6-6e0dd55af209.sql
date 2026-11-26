DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
  WHERE conrelid = 'public.ai_generated_flashcard_billing_reservations'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%(included_units + coin_units) = requested_units%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ai_generated_flashcard_billing_reservations DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.ai_generated_flashcard_billing_reservations
  ADD CONSTRAINT ai_generated_flashcard_billing_units_consistent CHECK (
    (generated_units IS NULL AND included_units + coin_units = requested_units)
    OR (generated_units IS NOT NULL AND generated_units <= requested_units
        AND included_units + coin_units = generated_units)
  );