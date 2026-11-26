CREATE TABLE public.microcontexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  audio_url text,
  video_url text,
  mindmap_data jsonb,
  user_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.microcontexts TO authenticated;
GRANT ALL ON public.microcontexts TO service_role;
ALTER TABLE public.microcontexts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own microcontexts" ON public.microcontexts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX microcontexts_topic_order_idx ON public.microcontexts(topic_id, order_index);
CREATE INDEX microcontexts_user_idx ON public.microcontexts(user_id);
CREATE TRIGGER microcontexts_updated_at BEFORE UPDATE ON public.microcontexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS microcontext_id uuid REFERENCES public.microcontexts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS flashcards_microcontext_idx ON public.flashcards(microcontext_id);