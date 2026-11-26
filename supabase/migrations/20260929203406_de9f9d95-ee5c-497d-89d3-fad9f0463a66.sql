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