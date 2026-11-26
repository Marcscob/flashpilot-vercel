CREATE TABLE IF NOT EXISTS public.game_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'match' CHECK (kind IN ('match')),
  title text NOT NULL,
  language text,
  action_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.game_decks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deck_id, position)
);

CREATE INDEX IF NOT EXISTS game_decks_topic_idx ON public.game_decks (topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_decks_user_idx ON public.game_decks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_rounds_deck_idx ON public.game_rounds (deck_id, position);

ALTER TABLE public.game_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;

-- Criação só pelo servidor (service_role); o aluno apenas lê e apaga os próprios games.
REVOKE ALL ON public.game_decks FROM anon, authenticated;
REVOKE ALL ON public.game_rounds FROM anon, authenticated;
GRANT SELECT, DELETE ON public.game_decks TO authenticated;
GRANT SELECT ON public.game_rounds TO authenticated;
GRANT ALL ON public.game_decks TO service_role;
GRANT ALL ON public.game_rounds TO service_role;

DROP POLICY IF EXISTS "game_decks_select_own" ON public.game_decks;
CREATE POLICY "game_decks_select_own" ON public.game_decks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "game_decks_delete_own" ON public.game_decks;
CREATE POLICY "game_decks_delete_own" ON public.game_decks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "game_rounds_select_own" ON public.game_rounds;
CREATE POLICY "game_rounds_select_own" ON public.game_rounds
  FOR SELECT TO authenticated USING (user_id = auth.uid());
