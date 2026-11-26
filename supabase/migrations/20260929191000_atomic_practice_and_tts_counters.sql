-- Corrige duas corridas de "leia-modifique-grave" (contadores não atômicos):
--
-- 1) language_repeat_phrases.times_practiced / best_score: o código lia os
--    valores atuais e gravava (valor_lido + 1) / max(valor_lido, score) de
--    volta. Duas tentativas concorrentes do mesmo aluno na mesma frase podiam
--    ler o mesmo valor e sobrescrever uma a outra, perdendo uma contagem de
--    prática ou um recorde de pontuação melhor.
-- 2) tts_cache.use_count: mesmo padrão (lê e grava use_count + 1); usado só
--    para estatística de reaproveitamento, mas a correção é igualmente
--    barata via RPC atômica.
--
-- Ambas as funções fazem UPDATE ... SET col = col + 1 em uma única instrução,
-- que o Postgres executa atomicamente sob a linha bloqueada (row lock
-- implícito do UPDATE), eliminando a janela de corrida entre leitura e
-- escrita que existia no código JS.

CREATE OR REPLACE FUNCTION public.record_repeat_phrase_practice(p_id uuid, p_score integer)
RETURNS TABLE (times_practiced integer, best_score integer, last_practiced_at timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.language_repeat_phrases
  SET times_practiced = times_practiced + 1,
      best_score = GREATEST(COALESCE(best_score, 0), p_score),
      last_practiced_at = now()
  WHERE id = p_id AND user_id = auth.uid()
  RETURNING times_practiced, best_score, last_practiced_at;
$$;

GRANT EXECUTE ON FUNCTION public.record_repeat_phrase_practice(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.bump_tts_cache_usage(p_id uuid, p_origin text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.tts_cache
  SET use_count = use_count + 1,
      last_used_at = now(),
      origin = p_origin
  WHERE id = p_id;
$$;

-- Só o servidor (service_role) chama esta função, via cliente admin do TTS cache.
REVOKE ALL ON FUNCTION public.bump_tts_cache_usage(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_tts_cache_usage(uuid, text) TO service_role;
