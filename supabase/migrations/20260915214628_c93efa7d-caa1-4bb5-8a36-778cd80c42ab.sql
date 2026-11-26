-- Fase 11 — endurece o acesso às mensagens: a sessão também precisa ser do usuário.
DROP POLICY IF EXISTS "own language chat messages" ON public.language_chat_messages;

CREATE POLICY "own language chat messages" ON public.language_chat_messages
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.language_chat_sessions s
      WHERE s.id = language_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.language_chat_sessions s
      WHERE s.id = language_chat_messages.session_id
        AND s.user_id = auth.uid()
    )
  );