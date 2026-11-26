-- Fix security linter warnings:
-- 1. Revoke EXECUTE on trigger function block_content_creation_when_trial_expired
-- 2. Add explicit deny-all policies on service-role-only tables (RLS enabled, no policy)
--    so the intent (locked to anon/authenticated, server-only via service_role) is explicit.

-- 1. Trigger function must not be callable directly
revoke execute on function public.block_content_creation_when_trial_expired() from public, anon, authenticated;

-- 2. Explicit deny-all policies on server-only tables
do $$
declare
  t text;
  server_only_tables text[] := array[
    'ai_action_costs',
    'ai_budget_limits',
    'ai_budget_reservations',
    'ai_chat_tts_authorizations',
    'ai_flashcoin_holds',
    'ai_generated_flashcard_billing_reservations',
    'ai_generated_flashcard_outputs',
    'ai_generation_leases',
    'ai_note_format_sessions',
    'ai_quota_reservations',
    'ai_quota_usage',
    'ai_trial_entitlements',
    'ai_usage_ledger',
    'ai_welcome_grants',
    'blog_comments',
    'blog_subscribers',
    'flashcard_save_receipts',
    'flashcard_usage',
    'purchase_refund_allocations',
    'tts_cache'
  ];
begin
  foreach t in array server_only_tables loop
    execute format(
      'create policy "server_only_deny_all" on public.%I for all to anon, authenticated using (false) with check (false)',
      t
    );
  end loop;
end $$;