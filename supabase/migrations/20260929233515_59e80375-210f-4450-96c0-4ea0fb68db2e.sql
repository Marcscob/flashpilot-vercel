-- Permite registrar uso de transcrição por voz (STT) na mesma tabela de
-- métricas de consumo de IA usada por tts_cloud/chat, para aplicar um
-- limite mensal de chamadas por usuário (ver STT_MONTHLY_CALLS_LIMIT).
ALTER TABLE public.ai_usage DROP CONSTRAINT IF EXISTS ai_usage_kind_check;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_kind_check
  CHECK (kind IN ('tts_cloud', 'chat', 'stt'));