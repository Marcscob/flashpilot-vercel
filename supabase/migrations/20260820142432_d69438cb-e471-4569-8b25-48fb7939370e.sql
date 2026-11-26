CREATE TABLE public.note_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.note_categories(id) ON DELETE CASCADE,
  note_id uuid REFERENCES public.notes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('image','video')),
  title text NOT NULL DEFAULT 'Sem título',
  storage_path text,
  url text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_media TO authenticated;
GRANT ALL ON public.note_media TO service_role;

ALTER TABLE public.note_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own note media" ON public.note_media FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX note_media_user_cat_idx ON public.note_media (user_id, category_id);
CREATE INDEX note_media_note_idx ON public.note_media (note_id);