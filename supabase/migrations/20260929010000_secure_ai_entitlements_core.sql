-- Establish server-owned authority for profiles, AI usage, budget reservations,
-- quotas, and recoverable document jobs. Application endpoints are updated in
-- the same release to use the protected server paths.

CREATE OR REPLACE FUNCTION public.is_app_manager_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_user_id
      AND (
        lower(COALESCE(email, '')) = 'guit1966@gmail.com'
        OR COALESCE(raw_app_meta_data ->> 'is_app_manager', 'false') = 'true'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_manager_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_manager_user(uuid) TO service_role;

-- Create a zero-balance profile for every new auth user. Existing users are
-- backfilled without changing any existing balances.
CREATE OR REPLACE FUNCTION public.create_profile_for_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata jsonb;
BEGIN
  metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  INSERT INTO public.profiles (
    user_id,
    flashcoins_balance,
    full_name,
    phone,
    phone_country,
    ui_lang,
    terms_accepted_at
  )
  VALUES (
    NEW.id,
    0,
    NULLIF(LEFT(metadata ->> 'full_name', 120), ''),
    NULLIF(LEFT(metadata ->> 'phone', 24), ''),
    CASE
      WHEN metadata ->> 'phone_country' ~ '^[A-Z]{2}$' THEN metadata ->> 'phone_country'
      ELSE NULL
    END,
    CASE
      WHEN metadata ->> 'ui_lang' IN ('pt', 'pt-PT', 'es', 'en', 'fr', 'it', 'de')
        THEN metadata ->> 'ui_lang'
      ELSE NULL
    END,
    CASE
      WHEN metadata ->> 'terms_accepted' = 'true' THEN now()
      ELSE NULL
    END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_for_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS create_profile_after_auth_user_insert ON auth.users;
CREATE TRIGGER create_profile_after_auth_user_insert
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_auth_user();

INSERT INTO public.profiles (user_id, flashcoins_balance)
SELECT u.id, 0
FROM auth.users AS u
ON CONFLICT (user_id) DO NOTHING;

DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update consents" ON public.profiles;
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- Client-created usage rows could be used to falsify quota state. Keep legacy
-- usage readable by its owner, but make all writes server-only.
DROP POLICY IF EXISTS "own ai usage insert" ON public.ai_usage;
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_budget_limits (
  id smallint PRIMARY KEY CHECK (id = 1),
  daily_limit_micros bigint NOT NULL CHECK (daily_limit_micros >= 0),
  monthly_limit_micros bigint NOT NULL CHECK (monthly_limit_micros >= 0),
  enabled boolean NOT NULL DEFAULT false,
  metering_ready boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_budget_limits
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metering_ready boolean NOT NULL DEFAULT false;

ALTER TABLE public.ai_budget_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_budget_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_budget_limits TO service_role;

INSERT INTO public.ai_budget_limits (id, daily_limit_micros, monthly_limit_micros, enabled)
VALUES (1, 500000, 15000000, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_usage_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  attempt_id uuid NOT NULL,
  resource text NOT NULL,
  amount bigint NOT NULL DEFAULT 0 CHECK (amount >= 0),
  reserved_micros bigint NOT NULL CHECK (reserved_micros >= 0),
  billed_micros bigint CHECK (billed_micros IS NULL OR billed_micros >= 0),
  rate_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved', 'uncertain', 'reconciled', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  UNIQUE (user_id, action_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS ai_usage_ledger_user_resource_created_idx
  ON public.ai_usage_ledger (user_id, resource, created_at DESC);

ALTER TABLE public.ai_usage_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_ledger FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_usage_ledger TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_quota_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  resource text NOT NULL,
  units bigint NOT NULL CHECK (units > 0),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end > period_start),
  UNIQUE (user_id, action_id, resource)
);

CREATE INDEX IF NOT EXISTS ai_quota_usage_user_resource_period_idx
  ON public.ai_quota_usage (user_id, resource, period_start, period_end);

ALTER TABLE public.ai_quota_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_quota_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_quota_usage TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_trial_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  maps_remaining integer NOT NULL DEFAULT 0 CHECK (maps_remaining >= 0),
  formats_remaining integer NOT NULL DEFAULT 0 CHECK (formats_remaining >= 0),
  chat_turns_remaining integer NOT NULL DEFAULT 0 CHECK (chat_turns_remaining >= 0),
  granted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_trial_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_trial_entitlements FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_trial_entitlements TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_welcome_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  device_hash text,
  subnet_hash text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_welcome_grants_device_hash_check
    CHECK (device_hash IS NULL OR device_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ai_welcome_grants_subnet_hash_check
    CHECK (subnet_hash IS NULL OR subnet_hash ~ '^[a-f0-9]{64}$')
);

ALTER TABLE public.ai_welcome_grants
  ADD COLUMN IF NOT EXISTS subnet_hash text,
  ALTER COLUMN device_hash DROP NOT NULL;
ALTER TABLE public.ai_welcome_grants
  DROP CONSTRAINT IF EXISTS ai_welcome_grants_device_hash_check,
  DROP CONSTRAINT IF EXISTS ai_welcome_grants_subnet_hash_check;
ALTER TABLE public.ai_welcome_grants
  ADD CONSTRAINT ai_welcome_grants_device_hash_check
    CHECK (device_hash IS NULL OR device_hash ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT ai_welcome_grants_subnet_hash_check
    CHECK (subnet_hash IS NULL OR subnet_hash ~ '^[a-f0-9]{64}$');

CREATE INDEX IF NOT EXISTS ai_welcome_grants_device_idx
  ON public.ai_welcome_grants (device_hash, granted_at DESC);
CREATE INDEX IF NOT EXISTS ai_welcome_grants_subnet_idx
  ON public.ai_welcome_grants (subnet_hash, granted_at DESC);
CREATE INDEX IF NOT EXISTS ai_welcome_grants_retention_idx
  ON public.ai_welcome_grants (granted_at)
  WHERE device_hash IS NOT NULL OR subnet_hash IS NOT NULL;

ALTER TABLE public.ai_welcome_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_welcome_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_welcome_grants TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_quota_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  job_id uuid NOT NULL,
  resource text NOT NULL,
  units bigint NOT NULL CHECK (units > 0),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved', 'consumed', 'released')),
  daily_counted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  CHECK (period_end > period_start),
  UNIQUE (user_id, action_id, resource)
);

CREATE INDEX IF NOT EXISTS ai_quota_reservations_user_resource_period_idx
  ON public.ai_quota_reservations (user_id, resource, period_start, period_end);

CREATE INDEX IF NOT EXISTS ai_quota_reservations_daily_jobs_idx
  ON public.ai_quota_reservations (user_id, job_id, created_at)
  WHERE daily_counted OR status IN ('reserved', 'consumed');

ALTER TABLE public.ai_quota_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_quota_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_quota_reservations TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_generation_leases (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  lease_id uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_generation_leases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_generation_leases TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_generated_flashcard_outputs (
  output_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  job_id uuid NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  question text NOT NULL,
  answer text NOT NULL,
  image_index integer CHECK (image_index IS NULL OR image_index BETWEEN 0 AND 19),
  saved_action_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  saved_at timestamptz,
  UNIQUE (user_id, action_id, ordinal),
  CHECK ((saved_action_id IS NULL) = (saved_at IS NULL))
);

CREATE INDEX IF NOT EXISTS ai_generated_flashcard_outputs_user_job_idx
  ON public.ai_generated_flashcard_outputs (user_id, job_id, saved_action_id);

ALTER TABLE public.ai_generated_flashcard_outputs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_generated_flashcard_outputs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_generated_flashcard_outputs TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_flashcoin_holds (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  job_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount >= 0),
  status text NOT NULL CHECK (status IN ('reserved', 'consumed', 'released')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  PRIMARY KEY (user_id, action_id),
  CHECK ((status = 'reserved' AND amount > 0) OR (status <> 'reserved'))
);

CREATE INDEX IF NOT EXISTS ai_flashcoin_holds_user_active_idx
  ON public.ai_flashcoin_holds (user_id, expires_at)
  WHERE status = 'reserved';

ALTER TABLE public.ai_flashcoin_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_flashcoin_holds FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_flashcoin_holds TO service_role;

CREATE OR REPLACE FUNCTION public.get_available_flashcoins(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(
    COALESCE((
      SELECT profile.flashcoins_balance
      FROM public.profiles profile
      WHERE profile.user_id = p_user_id
    ), 0) - COALESCE((
      SELECT SUM(hold.amount)
      FROM public.ai_flashcoin_holds hold
      WHERE hold.user_id = p_user_id
        AND hold.status = 'reserved'
        AND hold.expires_at > now()
    ), 0),
    0
  );
$$;

REVOKE ALL ON FUNCTION public.get_available_flashcoins(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_flashcoins(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_ai_generated_flashcards(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid
)
RETURNS TABLE (
  output_id uuid,
  ordinal integer,
  question text,
  answer text,
  image_index integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT output.output_id, output.ordinal, output.question, output.answer, output.image_index
  FROM public.ai_generated_flashcard_outputs output
  WHERE output.user_id = p_user_id
    AND output.action_id = p_action_id
    AND output.job_id = p_job_id
    AND output.saved_action_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.document_jobs job
      WHERE job.id = output.job_id
        AND job.user_id = output.user_id
        AND job.dismissed = false
        AND job.expires_at > clock_timestamp()
    )
  ORDER BY output.ordinal;
$$;

REVOKE ALL ON FUNCTION public.get_ai_generated_flashcards(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ai_generated_flashcards(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.register_ai_generated_flashcards(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid,
  p_lease_id uuid,
  p_cards jsonb,
  p_environment text
)
RETURNS TABLE (output_id uuid, ordinal integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
  v_quota record;
  v_count integer;
  v_existing_count integer;
  v_job_count bigint;
  v_held_coins bigint;
  v_lease public.ai_generation_leases%ROWTYPE;
  v_document_job public.document_jobs%ROWTYPE;
  v_is_app_manager boolean := false;
  v_is_pro boolean := false;
  v_balance numeric(14, 2);
BEGIN
  DELETE FROM public.ai_generated_flashcard_outputs
  WHERE created_at < now() - interval '90 days';

  IF p_user_id IS NULL OR p_action_id IS NULL OR p_job_id IS NULL OR p_lease_id IS NULL
     OR p_environment IS NULL
     OR p_environment NOT IN ('sandbox', 'live')
     OR p_cards IS NULL
     OR (CASE
       WHEN jsonb_typeof(p_cards) = 'array'
         THEN jsonb_array_length(p_cards) NOT BETWEEN 1 AND 2500
       ELSE true
     END) THEN
    RAISE EXCEPTION 'Invalid generated flashcard registration'
      USING ERRCODE = '22023';
  END IF;

  v_count := jsonb_array_length(p_cards);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));
  SELECT * INTO v_document_job
  FROM public.document_jobs
  WHERE id = p_job_id
    AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_document_job.dismissed OR v_document_job.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Document job was discarded or expired'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.ai_flashcoin_holds
  SET amount = 0, status = 'released', settled_at = now()
  WHERE user_id = p_user_id
    AND status = 'reserved'
    AND expires_at <= now();
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_cards) AS card(
      question text,
      answer text,
      image_index integer
    )
    WHERE NULLIF(BTRIM(card.question), '') IS NULL
       OR NULLIF(BTRIM(card.answer), '') IS NULL
       OR length(card.question) > 20000
       OR length(card.answer) > 40000
       OR (card.image_index IS NOT NULL AND card.image_index NOT BETWEEN 0 AND 19)
  ) THEN
    RAISE EXCEPTION 'Generated flashcard content is invalid'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.ai_generated_flashcard_outputs output
  WHERE output.user_id = p_user_id
    AND output.action_id = p_action_id;
  IF v_existing_count > 0 THEN
    IF v_existing_count <> v_count OR EXISTS (
      SELECT 1
      FROM public.ai_generated_flashcard_outputs output
      JOIN jsonb_array_elements(p_cards) WITH ORDINALITY AS input(card, ordinal)
        ON output.ordinal = input.ordinal - 1
      WHERE output.user_id = p_user_id
        AND output.action_id = p_action_id
        AND (
          output.job_id <> p_job_id
          OR output.question <> BTRIM(input.card ->> 'question')
          OR output.answer <> BTRIM(input.card ->> 'answer')
          OR output.image_index IS DISTINCT FROM NULLIF(input.card ->> 'image_index', '')::integer
        )
    ) THEN
      RAISE EXCEPTION 'Generated flashcard action was reused with different content'
        USING ERRCODE = '22023';
    END IF;
    RETURN QUERY
    SELECT output.output_id, output.ordinal
    FROM public.ai_generated_flashcard_outputs output
    WHERE output.user_id = p_user_id
      AND output.action_id = p_action_id
    ORDER BY output.ordinal;
    RETURN;
  END IF;

  SELECT * INTO v_lease
  FROM public.ai_generation_leases
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND lease_id = p_lease_id
    AND lease_expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generated flashcard request no longer owns the active lease'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations reservation
  WHERE reservation.user_id = p_user_id
    AND reservation.action_id = p_action_id
    AND reservation.job_id = p_job_id
    AND reservation.resource = 'flashcards_job'
    AND reservation.status = 'reserved'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Generated flashcard request has no active authorization'
      USING ERRCODE = '42501';
  END IF;

  SELECT public.is_app_manager_user(p_user_id) INTO v_is_app_manager;
  IF NOT v_is_app_manager THEN
    SELECT EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = p_user_id
        AND environment = p_environment
        AND status IN ('active', 'trialing', 'past_due', 'canceled')
        AND current_period_start = v_reservation.period_start
        AND current_period_end = v_reservation.period_end
        AND current_period_end > now()
    ) INTO v_is_pro;
  ELSE
    v_is_pro := true;
  END IF;

  SELECT COUNT(*) INTO v_job_count
  FROM public.ai_generated_flashcard_outputs
  WHERE user_id = p_user_id
    AND job_id = p_job_id;

  IF v_job_count + v_count > (CASE
    WHEN v_is_app_manager THEN 2500
    WHEN v_is_pro THEN 150
    ELSE 40
  END) THEN
    RAISE EXCEPTION 'Generated flashcard job limit exceeded'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_is_pro AND NOT v_is_app_manager THEN
    SELECT * INTO v_quota
    FROM public.reserve_ai_quota(
      p_user_id,
      p_action_id,
      p_job_id,
      'flashcards_saved',
      v_count,
      p_environment
    );
    IF v_quota.was_existing THEN
      RAISE EXCEPTION 'Generated flashcard quota action was already used'
        USING ERRCODE = '22023';
    END IF;
    PERFORM public.settle_ai_quota(v_quota.reservation_id, true, true);
  ELSIF NOT v_is_pro THEN
    SELECT flashcoins_balance INTO v_balance
    FROM public.profiles
    WHERE user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
    END IF;
    SELECT COALESCE(SUM(amount), 0) INTO v_held_coins
    FROM public.ai_flashcoin_holds
    WHERE user_id = p_user_id
      AND status = 'reserved'
      AND expires_at > now();
    IF v_balance - v_held_coins < v_count THEN
      RAISE EXCEPTION 'Saldo insuficiente de FlashCoins para reservar estes flashcards'
        USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.ai_flashcoin_holds (
      user_id, action_id, job_id, amount, status, expires_at
    )
    VALUES (
      p_user_id,
      p_action_id,
      p_job_id,
      v_count,
      'reserved',
      LEAST(clock_timestamp() + interval '24 hours', v_document_job.expires_at)
    );
  END IF;

  INSERT INTO public.ai_generated_flashcard_outputs (
    user_id, action_id, job_id, ordinal, question, answer, image_index
  )
  SELECT
    p_user_id,
    p_action_id,
    p_job_id,
    input.ordinal::integer - 1,
    BTRIM(input.card ->> 'question'),
    BTRIM(input.card ->> 'answer'),
    NULLIF(input.card ->> 'image_index', '')::integer
  FROM jsonb_array_elements(p_cards) WITH ORDINALITY AS input(card, ordinal);

  RETURN QUERY
  SELECT output.output_id, output.ordinal
  FROM public.ai_generated_flashcard_outputs output
  WHERE output.user_id = p_user_id
    AND output.action_id = p_action_id
  ORDER BY output.ordinal;
END;
$$;

REVOKE ALL ON FUNCTION public.register_ai_generated_flashcards(uuid, uuid, uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_ai_generated_flashcards(uuid, uuid, uuid, uuid, jsonb, text)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.flashcard_save_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{32}$'),
  inserted_count integer NOT NULL CHECK (inserted_count > 0),
  balance_after numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_id)
);

ALTER TABLE public.flashcard_save_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flashcard_save_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.flashcard_save_receipts TO service_role;

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

REVOKE INSERT ON public.flashcards FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.flashcards TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_budget_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  attempt_id uuid NOT NULL,
  resource text NOT NULL,
  reserved_micros bigint NOT NULL CHECK (reserved_micros > 0),
  billed_micros bigint CHECK (billed_micros IS NULL OR billed_micros >= 0),
  rate_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved', 'uncertain', 'reconciled', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  UNIQUE (user_id, action_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS ai_budget_reservations_created_status_idx
  ON public.ai_budget_reservations (created_at, status);

ALTER TABLE public.ai_budget_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_budget_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_budget_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_budget(
  p_user_id uuid,
  p_action_id text,
  p_attempt_id uuid,
  p_resource text,
  p_reserved_micros bigint,
  p_rate_version text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.ai_budget_reservations%ROWTYPE;
  v_daily_limit bigint;
  v_monthly_limit bigint;
  v_budget_enabled boolean;
  v_daily_used bigint;
  v_monthly_used bigint;
  v_reservation_id uuid;
  v_now timestamptz := now();
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_month_start timestamptz := date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
  IF p_user_id IS NULL OR NULLIF(BTRIM(p_action_id), '') IS NULL
     OR p_attempt_id IS NULL OR NULLIF(BTRIM(p_resource), '') IS NULL
     OR NULLIF(BTRIM(p_rate_version), '') IS NULL OR p_reserved_micros <= 0 THEN
    RAISE EXCEPTION 'Invalid AI budget reservation' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.ai_budget_reservations')::bigint);

  SELECT * INTO v_existing
  FROM public.ai_budget_reservations
  WHERE user_id = p_user_id AND action_id = p_action_id AND attempt_id = p_attempt_id;

  IF FOUND THEN
    IF v_existing.reserved_micros <> p_reserved_micros
       OR v_existing.resource <> p_resource
       OR v_existing.rate_version <> p_rate_version THEN
      RAISE EXCEPTION 'Idempotency key reused with different reservation data'
        USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.id;
  END IF;

  SELECT daily_limit_micros, monthly_limit_micros, enabled AND metering_ready
  INTO v_daily_limit, v_monthly_limit, v_budget_enabled
  FROM public.ai_budget_limits
  WHERE id = 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI budget limits are not configured' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_budget_enabled THEN
    RAISE EXCEPTION 'Free AI budget protection is not activated' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN status IN ('reserved', 'uncertain') THEN reserved_micros
         WHEN status = 'reconciled' THEN COALESCE(billed_micros, 0)
         ELSE 0 END
  ), 0)
  INTO v_daily_used
  FROM public.ai_budget_reservations
  WHERE (created_at >= v_day_start AND created_at < v_day_start + interval '1 day')
     OR status IN ('reserved', 'uncertain');

  SELECT COALESCE(SUM(
    CASE WHEN status IN ('reserved', 'uncertain') THEN reserved_micros
         WHEN status = 'reconciled' THEN COALESCE(billed_micros, 0)
         ELSE 0 END
  ), 0)
  INTO v_monthly_used
  FROM public.ai_budget_reservations
  WHERE (created_at >= v_month_start AND created_at < v_month_start + interval '1 month')
     OR status IN ('reserved', 'uncertain');

  IF v_daily_used + p_reserved_micros > v_daily_limit
     OR v_monthly_used + p_reserved_micros > v_monthly_limit THEN
    RAISE EXCEPTION 'AI budget exhausted' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_budget_reservations (
    user_id, action_id, attempt_id, resource, reserved_micros, rate_version, status, created_at
  )
  VALUES (
    p_user_id, p_action_id, p_attempt_id, p_resource, p_reserved_micros, p_rate_version, 'reserved', v_now
  )
  RETURNING id INTO v_reservation_id;

  INSERT INTO public.ai_usage_ledger (
    user_id, action_id, attempt_id, resource, reserved_micros, rate_version, status, created_at
  )
  VALUES (
    p_user_id, p_action_id, p_attempt_id, p_resource, p_reserved_micros, p_rate_version, 'reserved', v_now
  );

  RETURN v_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_budget(uuid, text, uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_budget(uuid, text, uuid, text, bigint, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_ai_budget(
  p_reservation_id uuid,
  p_status text,
  p_billed_micros bigint DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_budget_reservations%ROWTYPE;
  v_billed_micros bigint;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('uncertain', 'reconciled', 'released')
     OR (p_status = 'reconciled' AND (p_billed_micros IS NULL OR p_billed_micros < 0))
     OR (p_status = 'released' AND COALESCE(p_billed_micros, 0) <> 0) THEN
    RAISE EXCEPTION 'Invalid AI budget reconciliation' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('public.ai_budget_reservations')::bigint);

  SELECT * INTO v_reservation
  FROM public.ai_budget_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI budget reservation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_reservation.status IN ('reconciled', 'released') THEN
    IF v_reservation.status <> p_status
       OR COALESCE(v_reservation.billed_micros, 0) <> COALESCE(p_billed_micros, 0) THEN
      RAISE EXCEPTION 'AI budget reservation already finalized differently'
        USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;

  v_billed_micros := CASE
    WHEN p_status = 'reconciled' THEN p_billed_micros
    WHEN p_status = 'released' THEN 0
    ELSE NULL
  END;

  UPDATE public.ai_budget_reservations
  SET status = p_status, billed_micros = v_billed_micros, reconciled_at = now()
  WHERE id = p_reservation_id;

  UPDATE public.ai_usage_ledger
  SET status = p_status, billed_micros = v_billed_micros, reconciled_at = now()
  WHERE user_id = v_reservation.user_id
    AND action_id = v_reservation.action_id
    AND attempt_id = v_reservation.attempt_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_ai_budget(uuid, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_ai_budget(uuid, text, bigint)
  TO service_role;

DROP FUNCTION IF EXISTS public.grant_ai_welcome_kit(uuid, text);

CREATE OR REPLACE FUNCTION public.grant_ai_welcome_kit(
  p_user_id uuid,
  p_device_hash text,
  p_subnet_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_email_confirmed timestamptz;
  v_prior_device_grants bigint;
  v_prior_subnet_grants bigint;
BEGIN
  IF p_user_id IS NULL OR p_device_hash IS NULL
     OR p_device_hash !~ '^[a-f0-9]{64}$'
     OR p_subnet_hash IS NULL
     OR p_subnet_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid welcome grant request' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE((
    SELECT enabled AND metering_ready FROM public.ai_budget_limits WHERE id = 1
  ), false) THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_subnet_hash, 1));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_hash, 2));

  UPDATE public.ai_welcome_grants
  SET subnet_hash = NULL
  WHERE granted_at < now() - interval '24 hours'
    AND subnet_hash IS NOT NULL;

  UPDATE public.ai_welcome_grants
  SET device_hash = NULL
  WHERE granted_at < now() - interval '180 days'
    AND device_hash IS NOT NULL;

  SELECT email_confirmed_at INTO v_email_confirmed
  FROM auth.users
  WHERE id = p_user_id;
  IF NOT FOUND OR v_email_confirmed IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.ai_welcome_grants WHERE user_id = p_user_id) THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_prior_device_grants
  FROM public.ai_welcome_grants
  WHERE device_hash = p_device_hash
    AND granted_at >= now() - interval '180 days';
  IF v_prior_device_grants >= 2 THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_prior_subnet_grants
  FROM public.ai_welcome_grants
  WHERE subnet_hash = p_subnet_hash
    AND granted_at >= now() - interval '24 hours';
  -- Allow shared networks headroom while limiting bulk account creation.
  IF v_prior_subnet_grants >= 50 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.ai_welcome_grants (user_id, device_hash, subnet_hash)
  VALUES (p_user_id, p_device_hash, p_subnet_hash);

  UPDATE public.profiles
  SET flashcoins_balance = flashcoins_balance + 40
  WHERE user_id = p_user_id;

  INSERT INTO public.flashcoin_ledger (
    user_id, amount, balance_after, reason, action_id
  )
  VALUES (
    p_user_id, 40, v_profile.flashcoins_balance + 40, 'welcome_kit',
    'welcome:' || p_user_id::text
  );

  INSERT INTO public.ai_trial_entitlements (
    user_id, maps_remaining, formats_remaining, chat_turns_remaining, granted_at
  )
  VALUES (p_user_id, 2, 3, 15, now())
  ON CONFLICT (user_id) DO UPDATE
  SET maps_remaining = 2,
      formats_remaining = 3,
      chat_turns_remaining = 15,
      granted_at = EXCLUDED.granted_at,
      updated_at = now()
  WHERE public.ai_trial_entitlements.granted_at IS NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_ai_welcome_kit(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ai_welcome_kit(uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_quota(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid,
  p_resource text,
  p_units bigint,
  p_environment text
)
RETURNS TABLE (
  reservation_id uuid,
  is_pro boolean,
  period_start timestamptz,
  period_end timestamptz,
  remaining_units bigint,
  was_existing boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.ai_quota_reservations%ROWTYPE;
  v_entitlements public.ai_trial_entitlements%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_limit bigint := 0;
  v_used bigint := 0;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_balance integer;
  v_budget_enabled boolean;
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_is_pro boolean := false;
  v_is_app_manager boolean := false;
  v_retry_existing boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL OR p_job_id IS NULL
     OR p_units IS NULL OR p_units <= 0 OR p_resource IS NULL OR p_resource NOT IN (
       'flashcards_job', 'flashcards_saved', 'mindmap', 'note_format',
       'chat_turn', 'tts_standalone'
     ) OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Invalid AI quota reservation' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  SELECT public.is_app_manager_user(p_user_id) INTO v_is_app_manager;
  v_is_pro := COALESCE(v_is_app_manager, false);

  SELECT * INTO v_existing
  FROM public.ai_quota_reservations
  WHERE user_id = p_user_id AND action_id = p_action_id AND resource = p_resource;

  IF FOUND THEN
    IF v_existing.units <> p_units OR v_existing.job_id <> p_job_id THEN
      RAISE EXCEPTION 'AI quota action cannot be reused' USING ERRCODE = '22023';
    END IF;
    IF v_existing.status = 'released' THEN
      IF v_existing.daily_counted THEN
        RAISE EXCEPTION 'AI quota action cannot be retried after provider submission'
          USING ERRCODE = '22023';
      END IF;
      v_retry_existing := true;
    ELSE
      SELECT v_is_pro OR EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = p_user_id
          AND environment = p_environment
          AND current_period_start = v_existing.period_start
          AND current_period_end = v_existing.period_end
          AND current_period_end > now()
      ) INTO v_is_pro;
      v_limit := CASE p_resource
        WHEN 'flashcards_saved' THEN 2500
        WHEN 'mindmap' THEN 50
        WHEN 'note_format' THEN 60
        WHEN 'chat_turn' THEN 400
        WHEN 'tts_standalone' THEN 100000
        ELSE 0
      END;
      IF v_is_app_manager THEN
        remaining_units := 2147483647;
      ELSIF v_is_pro THEN
        SELECT COALESCE(SUM(units), 0) INTO v_used
        FROM public.ai_quota_reservations
        WHERE user_id = p_user_id AND resource = p_resource
          AND status IN ('reserved', 'consumed')
          AND period_start = v_existing.period_start
          AND period_end = v_existing.period_end;
        v_limit := CASE WHEN v_limit = 0 THEN v_used ELSE v_limit END;
        remaining_units := GREATEST(0, v_limit - v_used);
      ELSE
        SELECT * INTO v_entitlements FROM public.ai_trial_entitlements WHERE user_id = p_user_id;
        remaining_units := CASE p_resource
          WHEN 'mindmap' THEN COALESCE(v_entitlements.maps_remaining, 0)
          WHEN 'note_format' THEN COALESCE(v_entitlements.formats_remaining, 0)
          WHEN 'chat_turn' THEN COALESCE(v_entitlements.chat_turns_remaining, 0)
          ELSE 0
        END;
      END IF;
      reservation_id := v_existing.id;
      is_pro := v_is_pro;
      period_start := v_existing.period_start;
      period_end := v_existing.period_end;
      was_existing := true;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF NOT v_is_app_manager THEN
    SELECT * INTO v_sub
    FROM public.subscriptions
    WHERE user_id = p_user_id
      AND environment = p_environment
      AND (
        (status IN ('active', 'trialing', 'past_due') AND current_period_end > now())
        OR (status = 'canceled' AND current_period_end > now())
      )
    ORDER BY created_at DESC
    LIMIT 1;
    v_is_pro := FOUND;
  END IF;

  IF v_is_app_manager THEN
    v_period_start := now();
    v_period_end := now() + interval '100 years';
    v_limit := NULL;
    v_balance := 2147483647;
  ELSIF v_is_pro THEN
    IF v_sub.current_period_start IS NULL OR v_sub.current_period_end IS NULL
       OR v_sub.current_period_start > now() OR v_sub.current_period_end <= now() THEN
      RAISE EXCEPTION 'Subscription billing cycle is not verified' USING ERRCODE = 'P0001';
    END IF;
    v_period_start := v_sub.current_period_start;
    v_period_end := v_sub.current_period_end;
    v_limit := CASE p_resource
      WHEN 'flashcards_saved' THEN 2500
      WHEN 'mindmap' THEN 50
      WHEN 'note_format' THEN 60
      WHEN 'chat_turn' THEN 400
      WHEN 'tts_standalone' THEN 100000
      WHEN 'flashcards_job' THEN NULL
      ELSE NULL
    END;
    IF v_limit IS NULL AND p_resource <> 'flashcards_job' THEN
      RAISE EXCEPTION 'Resource is not available on Pro' USING ERRCODE = 'P0001';
    END IF;
    SELECT COALESCE(SUM(units), 0) INTO v_used
    FROM public.ai_quota_reservations
    WHERE user_id = p_user_id
      AND resource = p_resource
      AND status IN ('reserved', 'consumed')
      AND period_start = v_period_start
      AND period_end = v_period_end;
    IF v_limit IS NOT NULL AND v_used + p_units > v_limit THEN
      RAISE EXCEPTION 'Pro resource quota exhausted' USING ERRCODE = 'P0001';
    END IF;
    v_balance := CASE WHEN v_limit IS NULL THEN 0
      ELSE GREATEST(0, (v_limit - v_used - p_units)::integer) END;
  ELSE
    SELECT enabled AND metering_ready INTO v_budget_enabled
    FROM public.ai_budget_limits
    WHERE id = 1;
    IF NOT COALESCE(v_budget_enabled, false) THEN
      RAISE EXCEPTION 'Free AI budget protection is not activated' USING ERRCODE = 'P0001';
    END IF;

    v_period_start := v_day_start;
    v_period_end := v_day_start + interval '1 day';
    SELECT * INTO v_entitlements
    FROM public.ai_trial_entitlements
    WHERE user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND OR v_entitlements.granted_at IS NULL THEN
      RAISE EXCEPTION 'Free AI trial is not available' USING ERRCODE = 'P0001';
    END IF;

    IF p_resource IN ('flashcards_job', 'mindmap', 'note_format') THEN
      SELECT COUNT(DISTINCT job_id) INTO v_used
      FROM public.ai_quota_reservations
      WHERE user_id = p_user_id
        AND resource IN ('flashcards_job', 'mindmap', 'note_format')
        AND created_at >= v_day_start
        AND (daily_counted OR status IN ('reserved', 'consumed'));
      IF v_used >= 5 THEN
        RAISE EXCEPTION 'Daily free AI job quota exhausted' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    v_balance := CASE p_resource
      WHEN 'mindmap' THEN v_entitlements.maps_remaining
      WHEN 'note_format' THEN v_entitlements.formats_remaining
      WHEN 'chat_turn' THEN v_entitlements.chat_turns_remaining
      WHEN 'flashcards_job' THEN 5
      ELSE 0
    END;
    IF p_resource = 'tts_standalone' OR p_resource = 'flashcards_saved' THEN
      RAISE EXCEPTION 'Resource is not available on Free' USING ERRCODE = 'P0001';
    END IF;
    IF v_balance < p_units THEN
      RAISE EXCEPTION 'Free resource quota exhausted' USING ERRCODE = 'P0001';
    END IF;

    IF p_resource = 'mindmap' THEN
      UPDATE public.ai_trial_entitlements
      SET maps_remaining = maps_remaining - p_units::integer, updated_at = now()
      WHERE user_id = p_user_id;
    ELSIF p_resource = 'note_format' THEN
      UPDATE public.ai_trial_entitlements
      SET formats_remaining = formats_remaining - p_units::integer, updated_at = now()
      WHERE user_id = p_user_id;
    ELSIF p_resource = 'chat_turn' THEN
      UPDATE public.ai_trial_entitlements
      SET chat_turns_remaining = chat_turns_remaining - p_units::integer, updated_at = now()
      WHERE user_id = p_user_id;
    END IF;
    v_balance := v_balance - p_units::integer;
  END IF;

  IF v_retry_existing THEN
    UPDATE public.ai_quota_reservations
    SET period_start = v_period_start,
        period_end = v_period_end,
        status = 'reserved',
        daily_counted = false,
        created_at = now(),
        settled_at = NULL
    WHERE id = v_existing.id
    RETURNING id INTO reservation_id;
  ELSE
    INSERT INTO public.ai_quota_reservations (
      user_id, action_id, job_id, resource, units, period_start, period_end, status
    )
    VALUES (
      p_user_id, p_action_id, p_job_id, p_resource, p_units, v_period_start, v_period_end, 'reserved'
    )
    RETURNING id INTO reservation_id;
  END IF;

  is_pro := v_is_pro;
  period_start := v_period_start;
  period_end := v_period_end;
  remaining_units := v_balance;
  was_existing := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_quota(uuid, uuid, uuid, text, bigint, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota(uuid, uuid, uuid, text, bigint, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.settle_ai_quota(
  p_reservation_id uuid,
  p_success boolean,
  p_was_sent boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.ai_quota_reservations')::bigint);
  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI quota reservation not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_reservation.status <> 'reserved' THEN
    IF (p_success AND v_reservation.status = 'consumed')
       OR (NOT p_success AND v_reservation.status = 'released') THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'AI quota reservation already settled differently'
      USING ERRCODE = '22023';
  END IF;

  IF p_success THEN
    UPDATE public.ai_quota_reservations
    SET status = 'consumed', daily_counted = true, settled_at = now()
    WHERE id = p_reservation_id;
  ELSE
    UPDATE public.ai_quota_reservations
    SET status = 'released', daily_counted = p_was_sent, settled_at = now()
    WHERE id = p_reservation_id;

    IF v_reservation.period_end = v_reservation.period_start + interval '1 day' THEN
      IF v_reservation.resource = 'mindmap' THEN
        UPDATE public.ai_trial_entitlements
        SET maps_remaining = maps_remaining + v_reservation.units::integer, updated_at = now()
        WHERE user_id = v_reservation.user_id;
      ELSIF v_reservation.resource = 'note_format' THEN
        UPDATE public.ai_trial_entitlements
        SET formats_remaining = formats_remaining + v_reservation.units::integer, updated_at = now()
        WHERE user_id = v_reservation.user_id;
      ELSIF v_reservation.resource = 'chat_turn' THEN
        UPDATE public.ai_trial_entitlements
        SET chat_turns_remaining = chat_turns_remaining + v_reservation.units::integer, updated_at = now()
        WHERE user_id = v_reservation.user_id;
      END IF;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ai_quota(uuid, boolean, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_quota(uuid, boolean, boolean)
  TO service_role;

CREATE OR REPLACE FUNCTION public.acquire_ai_generation_lease(
  p_user_id uuid,
  p_action_id uuid,
  p_lease_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
  v_job_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION 'Invalid AI generation lease' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND resource = 'flashcards_job';
  IF FOUND THEN
    IF v_reservation.status <> 'reserved' THEN
      RAISE EXCEPTION 'Document job generation reservation is no longer active'
        USING ERRCODE = '55P03';
    END IF;

    SELECT id INTO v_job_id
    FROM public.document_jobs
    WHERE id = v_reservation.job_id
      AND user_id = p_user_id
      AND dismissed = false
      AND expires_at > clock_timestamp()
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Document job was discarded or expired'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.ai_generation_leases (
    user_id, action_id, lease_id, lease_expires_at, updated_at
  )
  VALUES (
    p_user_id, p_action_id, p_lease_id, clock_timestamp() + interval '60 seconds', now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET action_id = EXCLUDED.action_id,
      lease_id = EXCLUDED.lease_id,
      lease_expires_at = EXCLUDED.lease_expires_at,
      updated_at = EXCLUDED.updated_at
  WHERE public.ai_generation_leases.lease_expires_at <= clock_timestamp()
     OR (
       public.ai_generation_leases.action_id = EXCLUDED.action_id
       AND public.ai_generation_leases.lease_id = EXCLUDED.lease_id
     );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Another AI operation is already active for this account'
      USING ERRCODE = '55P03';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_ai_generation_lease(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_ai_generation_lease(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.renew_ai_generation_lease(
  p_user_id uuid,
  p_action_id uuid,
  p_lease_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
  v_job_id uuid;
BEGIN
  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND resource = 'flashcards_job';
  IF FOUND THEN
    IF v_reservation.status <> 'reserved' THEN
      RAISE EXCEPTION 'Document job generation reservation is no longer active'
        USING ERRCODE = '55P03';
    END IF;

    SELECT id INTO v_job_id
    FROM public.document_jobs
    WHERE id = v_reservation.job_id
      AND user_id = p_user_id
      AND dismissed = false
      AND expires_at > clock_timestamp()
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Document job was discarded or expired'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  UPDATE public.ai_generation_leases
  SET lease_expires_at = clock_timestamp() + interval '60 seconds',
      updated_at = now()
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND lease_id = p_lease_id
    AND lease_expires_at > clock_timestamp();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AI generation lease expired or was replaced'
      USING ERRCODE = '55P03';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_ai_generation_lease(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_ai_generation_lease(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.release_ai_generation_lease(
  p_user_id uuid,
  p_action_id uuid,
  p_lease_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_generation_leases
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND lease_id = p_lease_id;
$$;

REVOKE ALL ON FUNCTION public.release_ai_generation_lease(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_ai_generation_lease(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.settle_ai_quota_for_generated_flashcards(
  p_user_id uuid,
  p_action_id uuid,
  p_job_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.ai_quota_reservations%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('public.ai_quota_reservations')::bigint);
  SELECT * INTO v_reservation
  FROM public.ai_quota_reservations
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND job_id = p_job_id
    AND resource = 'flashcards_job'
  FOR UPDATE;
  IF NOT FOUND OR v_reservation.status = 'released' THEN
    RAISE EXCEPTION 'Generated flashcard quota reservation is missing or released'
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.settle_ai_quota(v_reservation.id, true, true);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_ai_quota_for_generated_flashcards(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_ai_quota_for_generated_flashcards(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.has_ai_quota_action(
  p_user_id uuid,
  p_action_id uuid,
  p_resource text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ai_quota_reservations
    WHERE user_id = p_user_id
      AND action_id = p_action_id
      AND resource = p_resource
      AND status = 'consumed'
  );
$$;

REVOKE ALL ON FUNCTION public.has_ai_quota_action(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_ai_quota_action(uuid, uuid, text)
  TO service_role;

CREATE TABLE IF NOT EXISTS public.ai_chat_tts_authorizations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_id uuid NOT NULL,
  response_hash text NOT NULL CHECK (response_hash ~ '^[a-f0-9]{64}$'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_id)
);

ALTER TABLE public.ai_chat_tts_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_chat_tts_authorizations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_chat_tts_authorizations TO service_role;

CREATE OR REPLACE FUNCTION public.authorize_ai_chat_tts(
  p_user_id uuid,
  p_action_id uuid,
  p_response_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_hash text;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL
     OR p_response_hash IS NULL OR p_response_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid tutor TTS authorization' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ai_quota_reservations
    WHERE user_id = p_user_id
      AND action_id = p_action_id
      AND resource = 'chat_turn'
      AND status = 'consumed'
  ) THEN
    RAISE EXCEPTION 'Tutor turn was not consumed' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.ai_chat_tts_authorizations (user_id, action_id, response_hash)
  VALUES (p_user_id, p_action_id, p_response_hash)
  ON CONFLICT (user_id, action_id) DO NOTHING;

  SELECT response_hash INTO v_existing_hash
  FROM public.ai_chat_tts_authorizations
  WHERE user_id = p_user_id AND action_id = p_action_id
  FOR UPDATE;

  IF v_existing_hash <> p_response_hash THEN
    RAISE EXCEPTION 'Tutor TTS response does not match the authorized turn'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_ai_chat_tts(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_ai_chat_tts(uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_chat_tts(
  p_user_id uuid,
  p_action_id uuid,
  p_response_hash text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL
     OR p_response_hash IS NULL OR p_response_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid tutor TTS request' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_chat_tts_authorizations
  SET consumed_at = now()
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND response_hash = p_response_hash
    AND consumed_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tutor TTS is unavailable or already used'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_chat_tts(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_chat_tts(uuid, uuid, text)
  TO service_role;

-- Jobs are readable by their owner, but all creation and state changes must
-- pass through authenticated server functions.
ALTER TABLE public.document_jobs
  ADD COLUMN IF NOT EXISTS action_id text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');

CREATE UNIQUE INDEX IF NOT EXISTS document_jobs_user_action_id_idx
  ON public.document_jobs (user_id, action_id)
  WHERE action_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_jobs_expiry_idx
  ON public.document_jobs (expires_at);

DROP POLICY IF EXISTS "Users manage their own document jobs" ON public.document_jobs;
CREATE POLICY "Users read their own document jobs"
  ON public.document_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.document_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_jobs TO authenticated;
GRANT ALL ON public.document_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.delete_expired_document_jobs()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  UPDATE public.ai_flashcoin_holds
  SET amount = 0, status = 'released', settled_at = now()
  WHERE status = 'reserved'
    AND expires_at <= now();

  DELETE FROM public.ai_generated_flashcard_outputs
  WHERE created_at < now() - interval '90 days';

  WITH expired_jobs AS (
    SELECT job.id
    FROM public.document_jobs AS job
    WHERE job.expires_at <= clock_timestamp()
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_budget_reservations AS reservation
        WHERE reservation.user_id = job.user_id
          AND reservation.action_id = job.action_id
          AND reservation.status IN ('reserved', 'uncertain')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.ai_generation_leases AS lease
        JOIN public.ai_quota_reservations AS reservation
          ON reservation.user_id = lease.user_id
         AND reservation.action_id = lease.action_id
        WHERE reservation.user_id = job.user_id
          AND reservation.job_id = job.id
          AND reservation.resource = 'flashcards_job'
          AND lease.lease_expires_at > clock_timestamp()
      )
    ORDER BY job.expires_at, job.id
    FOR UPDATE OF job SKIP LOCKED
  )
  DELETE FROM public.document_jobs AS job
  USING expired_jobs
  WHERE job.id = expired_jobs.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_expired_document_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_expired_document_jobs() TO service_role;

CREATE OR REPLACE FUNCTION public.discard_ai_generated_flashcard_job(
  p_user_id uuid,
  p_job_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_job_id IS NULL THEN
    RAISE EXCEPTION 'Invalid document job discard request' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 2));

  SELECT id INTO v_job_id
  FROM public.document_jobs
  WHERE id = p_job_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document job not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Document job not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_generation_leases AS lease
    JOIN public.ai_quota_reservations AS reservation
      ON reservation.user_id = lease.user_id
     AND reservation.action_id = lease.action_id
    WHERE reservation.user_id = p_user_id
      AND reservation.job_id = p_job_id
      AND reservation.resource = 'flashcards_job'
      AND lease.lease_expires_at > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'Document job has an active generation; retry discard after it stops'
      USING ERRCODE = '55P03';
  END IF;

  DELETE FROM public.ai_generated_flashcard_outputs
  WHERE user_id = p_user_id
    AND job_id = p_job_id
    AND saved_action_id IS NULL;

  UPDATE public.ai_flashcoin_holds
  SET amount = 0,
      status = 'released',
      settled_at = now()
  WHERE user_id = p_user_id
    AND job_id = p_job_id
    AND status = 'reserved';

  UPDATE public.ai_quota_reservations
  SET status = 'released',
      daily_counted = true,
      settled_at = now()
  WHERE user_id = p_user_id
    AND job_id = p_job_id
    AND resource = 'flashcards_job'
    AND status = 'reserved';

  UPDATE public.document_jobs
  SET dismissed = true,
      input_slices = '[]'::jsonb,
      input_images = '[]'::jsonb,
      result_cards = '[]'::jsonb,
      cards_count = 0,
      error_message = NULL,
      updated_at = now()
  WHERE id = p_job_id
    AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.discard_ai_generated_flashcard_job(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discard_ai_generated_flashcard_job(uuid, uuid)
  TO service_role;
