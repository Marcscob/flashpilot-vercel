
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_category_id uuid REFERENCES public.note_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS flashcards_image_category_id_idx ON public.flashcards(image_category_id);

-- Storage policies: users manage their own folder inside flashcard-mindmaps
CREATE POLICY "own mindmap read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'flashcard-mindmaps' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own mindmap insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'flashcard-mindmaps' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own mindmap update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'flashcard-mindmaps' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "own mindmap delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'flashcard-mindmaps' AND auth.uid()::text = (storage.foldername(name))[1]);
