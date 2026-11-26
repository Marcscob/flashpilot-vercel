-- Fase 10 — persistência das conversas do Módulo de Idiomas.
CREATE TABLE IF NOT EXISTS public.language_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang text NOT NULL,
  title text NOT NULL DEFAULT 'Conversa',
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  level text,
  topic text,
  mode text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.language_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.language_chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  correction_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS language_chat_sessions_user_idx
  ON public.language_chat_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS language_chat_messages_session_idx
  ON public.language_chat_messages (session_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.language_chat_sessions TO authenticated;
GRANT ALL ON public.language_chat_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.language_chat_messages TO authenticated;
GRANT ALL ON public.language_chat_messages TO service_role;

ALTER TABLE public.language_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own language chat sessions" ON public.language_chat_sessions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own language chat messages" ON public.language_chat_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER language_chat_sessions_updated_at
  BEFORE UPDATE ON public.language_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
