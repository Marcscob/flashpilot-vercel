-- tts_cache (e o bucket "tts-cache") só são lidos/gravados pelo servidor via
-- service_role (ver src/lib/tts-cache.functions.ts e
-- src/routes/api/public/tts-cache-cleanup.ts). O cliente do navegador nunca
-- consulta essa tabela nem esse bucket diretamente: ele só recebe uma signed
-- URL temporária já gerada pelo servidor.
--
-- Apesar disso, as policies originais eram amplas demais:
--   - tts_cache: SELECT/UPDATE com USING(true) para qualquer authenticated,
--     permitindo ler o storage_path de áudios de OUTROS alunos (origin
--     'student' é particionado por user_id apenas no path, sem checagem de
--     dono na policy) e também sobrescrever qualquer linha (cache poisoning).
--   - storage.objects (bucket tts-cache): SELECT com USING(bucket_id = ...)
--     para qualquer authenticated, permitindo baixar diretamente qualquer
--     arquivo do bucket (inclusive gravações pessoais de outros alunos) sem
--     depender da signed URL temporária emitida pelo servidor.
--
-- Como nenhum caminho legítimo do app usa o cliente comum para essas
-- operações, revogamos o acesso de "authenticated" e mantemos apenas
-- service_role (que já ignora RLS).

REVOKE SELECT, INSERT, UPDATE ON public.tts_cache FROM authenticated;

DROP POLICY IF EXISTS "tts cache readable by signed in users" ON public.tts_cache;
DROP POLICY IF EXISTS "tts cache insert by signed in users" ON public.tts_cache;
DROP POLICY IF EXISTS "tts cache usage update by signed in users" ON public.tts_cache;

DROP POLICY IF EXISTS "tts cache audio readable by signed in users" ON storage.objects;
DROP POLICY IF EXISTS "tts cache audio upload by signed in users" ON storage.objects;
