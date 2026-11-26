-- language_chat_messages é gravada pelo client com o cliente comum do
-- usuário (RLS por auth.uid()), sem passar por nenhuma rota do servidor.
-- O limite de 400/2000 caracteres é hoje só validado no client e no
-- endpoint de resposta da IA — nada impede uma chamada direta à API do
-- Supabase (via devtools/script) inserindo um "content" arbitrariamente
-- grande, o que não gera custo de IA mas permite inchar a tabela sem
-- limite (abuso de armazenamento). Trava isso com um CHECK de tamanho,
-- generoso o bastante para não quebrar conversas legítimas.
ALTER TABLE public.language_chat_messages
  ADD CONSTRAINT language_chat_messages_content_length
  CHECK (char_length(content) <= 20000);