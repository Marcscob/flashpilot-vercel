
CREATE TABLE public.note_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.note_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_categories TO authenticated;
GRANT ALL ON public.note_categories TO service_role;
ALTER TABLE public.note_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own note categories" ON public.note_categories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.notes
  ADD COLUMN category_id UUID REFERENCES public.note_categories(id) ON DELETE SET NULL;

ALTER TABLE public.flashcards
  ADD COLUMN linked_note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL;
