-- Blinda o TTS do tutor de chat contra custo ilimitado de provider.
--
-- Antes: synthesizeAuthorized (origin="chat") chamava o provider de TTS e só
-- depois checava consume_ai_chat_tts. Como consume_ai_chat_tts só marca
-- consumido *após* a síntese ser bem-sucedida, um chamador podia repetir a
-- mesma requisição (mesmo actionId + mesmo texto autorizado) indefinidamente:
-- cada tentativa disparava uma síntese paga real antes de falhar no passo
-- final. A trava de lease (acquire_ai_generation_lease) só impede execução
-- *concorrente*, não impede repetição sequencial.
--
-- Correção: uma reivindicação atômica (claim) com limite de tentativas,
-- executada ANTES da chamada ao provider. Retentativas transitórias
-- continuam possíveis (até o limite), mas o custo do provider fica limitado.

ALTER TABLE public.ai_chat_tts_authorizations
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.claim_ai_chat_tts_attempt(
  p_user_id uuid,
  p_action_id uuid,
  p_response_hash text,
  p_max_attempts integer DEFAULT 3
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_user_id IS NULL OR p_action_id IS NULL
     OR p_response_hash IS NULL OR p_response_hash !~ '^[a-f0-9]{64}$'
     OR p_max_attempts IS NULL OR p_max_attempts < 1 THEN
    RAISE EXCEPTION 'Invalid tutor TTS attempt claim' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ai_chat_tts_authorizations
  SET attempts = attempts + 1
  WHERE user_id = p_user_id
    AND action_id = p_action_id
    AND response_hash = p_response_hash
    AND consumed_at IS NULL
    AND attempts < p_max_attempts;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Tutor TTS is unavailable or exceeded its attempt limit'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ai_chat_tts_attempt(uuid, uuid, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_chat_tts_attempt(uuid, uuid, text, integer)
  TO service_role;