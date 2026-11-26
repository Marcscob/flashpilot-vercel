-- Vários campos de texto livre gravados diretamente pelo client (RLS por
-- auth.uid(), sem passar por rota server-side com validação Zod) não têm
-- nenhum limite de tamanho no banco. Um usuário autenticado pode inserir
-- valores arbitrariamente grandes via chamada direta à API do Supabase
-- (bypassando qualquer maxLength da UI), inchando essas tabelas sem
-- controle (abuso de armazenamento/custo de infraestrutura).
--
-- Usa NOT VALID em todas para não falhar por causa de linhas antigas que já
-- excedam o limite (elas continuam legíveis/editáveis normalmente); só
-- passa a valer para linhas novas ou atualizadas a partir de agora.

ALTER TABLE public.notes
  ADD CONSTRAINT notes_title_length CHECK (char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT notes_content_html_length CHECK (char_length(content_html) <= 500000) NOT VALID;

ALTER TABLE public.notes
  ADD CONSTRAINT notes_content_html_backup_length CHECK (char_length(content_html_backup) <= 500000) NOT VALID;

ALTER TABLE public.note_categories
  ADD CONSTRAINT note_categories_name_length CHECK (char_length(name) <= 200) NOT VALID;

ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_name_length CHECK (char_length(name) <= 200) NOT VALID;

ALTER TABLE public.topics
  ADD CONSTRAINT topics_name_length CHECK (char_length(name) <= 200) NOT VALID;

ALTER TABLE public.flashcards
  ADD CONSTRAINT flashcards_question_length CHECK (char_length(question) <= 20000) NOT VALID,
  ADD CONSTRAINT flashcards_answer_length CHECK (char_length(answer) <= 40000) NOT VALID,
  ADD CONSTRAINT flashcards_user_answer_length CHECK (char_length(user_answer) <= 40000) NOT VALID,
  ADD CONSTRAINT flashcards_conversion_reason_length CHECK (char_length(conversion_reason) <= 1000) NOT VALID;

ALTER TABLE public.language_chat_sessions
  ADD CONSTRAINT language_chat_sessions_title_length CHECK (char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT language_chat_sessions_topic_length CHECK (char_length(topic) <= 500) NOT VALID,
  ADD CONSTRAINT language_chat_sessions_lang_length CHECK (char_length(lang) <= 20) NOT VALID,
  ADD CONSTRAINT language_chat_sessions_level_length CHECK (char_length(level) <= 50) NOT VALID,
  ADD CONSTRAINT language_chat_sessions_mode_length CHECK (char_length(mode) <= 50) NOT VALID;

ALTER TABLE public.note_media
  ADD CONSTRAINT note_media_title_length CHECK (char_length(title) <= 200) NOT VALID,
  ADD CONSTRAINT note_media_storage_path_length CHECK (char_length(storage_path) <= 1000) NOT VALID,
  ADD CONSTRAINT note_media_url_length CHECK (char_length(url) <= 2048) NOT VALID;

ALTER TABLE public.study_notebooks
  ADD CONSTRAINT study_notebooks_name_length CHECK (char_length(name) <= 200) NOT VALID;