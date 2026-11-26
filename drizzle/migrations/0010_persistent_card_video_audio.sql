ALTER TABLE public.card_videos ADD COLUMN IF NOT EXISTS audio_storage_path text;
ALTER TABLE public.card_videos ADD COLUMN IF NOT EXISTS audio_voice text;
ALTER TABLE public.card_videos ADD COLUMN IF NOT EXISTS audio_mime text;
CREATE POLICY "authorized official card videos read" ON public.card_videos FOR SELECT TO authenticated USING (
  public.is_app_manager_user(user_id)
  AND EXISTS (SELECT 1 FROM public.flashcards f WHERE f.id = card_videos.card_id AND public.is_app_manager_user(f.user_id))
);
REVOKE UPDATE ON public.card_videos FROM authenticated;
GRANT UPDATE (transcript_note) ON public.card_videos TO authenticated;
CREATE INDEX IF NOT EXISTS card_videos_card_created_idx ON public.card_videos (card_id, created_at DESC);