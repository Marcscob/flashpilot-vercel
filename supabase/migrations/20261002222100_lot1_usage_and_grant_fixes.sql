-- Lote 1: preserva prazos de acesso e separa mapas mentais do histórico de chat.

CREATE OR REPLACE FUNCTION public.extend_subject_grant(
  p_user_id uuid,
  p_product_id text,
  p_expires_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.subject_grants
  SET expires_at = GREATEST(
    COALESCE(expires_at, '-infinity'::timestamptz),
    p_expires_at
  )
  WHERE user_id = p_user_id
    AND product_id = p_product_id
    AND p_expires_at IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.extend_subject_grant(uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_subject_grant(uuid, text, timestamptz)
  TO service_role;

ALTER TABLE public.ai_usage
  DROP CONSTRAINT IF EXISTS ai_usage_kind_check;

ALTER TABLE public.ai_usage
  ADD CONSTRAINT ai_usage_kind_check
  CHECK (kind IN ('tts_cloud', 'chat', 'stt', 'mindmap'));
