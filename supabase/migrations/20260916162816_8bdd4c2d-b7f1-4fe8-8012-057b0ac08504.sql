CREATE TABLE IF NOT EXISTS public.language_repeat_phrases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lang text NOT NULL,
  level text,
  topic text,
  text text NOT NULL,
  times_practiced integer NOT NULL DEFAULT 0,
  best_score integer,
  last_practiced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.language_repeat_phrases TO authenticated;
GRANT ALL ON public.language_repeat_phrases TO service_role;

ALTER TABLE public.language_repeat_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own repeat phrases"
  ON public.language_repeat_phrases FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS language_repeat_phrases_user_lang_idx
  ON public.language_repeat_phrases (user_id, lang, created_at DESC);

CREATE TRIGGER language_repeat_phrases_updated_at
  BEFORE UPDATE ON public.language_repeat_phrases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();