-- Catálogo de áudios: acesso exclusivo do servidor (service_role), sem políticas de cliente.
DROP POLICY IF EXISTS "tts cache readable by signed in users" ON public.tts_cache;
DROP POLICY IF EXISTS "tts cache insert by signed in users" ON public.tts_cache;
DROP POLICY IF EXISTS "tts cache usage update by signed in users" ON public.tts_cache;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.tts_cache FROM authenticated, anon;
GRANT ALL ON public.tts_cache TO service_role;

-- Arquivos de áudio do cache: nenhum acesso direto de clientes; o servidor gera URLs assinadas.
DROP POLICY IF EXISTS "tts cache audio readable by signed in users" ON storage.objects;
DROP POLICY IF EXISTS "tts cache audio upload by signed in users" ON storage.objects;

-- Custos das ações de IA: só o painel do administrador (service_role) consulta.
DROP POLICY IF EXISTS "costs readable" ON public.ai_action_costs;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_action_costs FROM authenticated, anon;
GRANT ALL ON public.ai_action_costs TO service_role;