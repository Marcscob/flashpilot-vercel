-- Trial nudge emails (day 9 reengagement, day 14 end-of-trial warning) and the
-- subscriber welcome email. Each is sent at most once per user, tracked by a
-- dedicated timestamp column so retries/duplicate cron runs are safe no-ops.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_day9_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_day14_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscriber_welcome_email_sent_at timestamptz;
