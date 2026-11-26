CREATE TABLE public.card_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid NOT NULL,
  is_official boolean NOT NULL DEFAULT false,
  lang text NOT NULL,
  style text NOT NULL CHECK (style IN ('avatar','motion','both')),
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  transcript text NOT NULL DEFAULT '',
  transcript_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.card_videos TO authenticated;
GRANT ALL ON public.card_videos TO service_role;
ALTER TABLE public.card_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own videos read" ON public.card_videos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own videos update" ON public.card_videos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own videos delete" ON public.card_videos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX card_videos_card_idx ON public.card_videos (user_id, card_id, created_at DESC);