ALTER TABLE public.card_videos ALTER COLUMN card_id DROP NOT NULL;
ALTER TABLE public.card_videos ADD COLUMN IF NOT EXISTS microcontext_id uuid REFERENCES public.microcontexts(id) ON DELETE CASCADE;
ALTER TABLE public.card_videos DROP CONSTRAINT IF EXISTS card_videos_one_parent;
ALTER TABLE public.card_videos ADD CONSTRAINT card_videos_one_parent CHECK ((card_id IS NULL) <> (microcontext_id IS NULL));
CREATE INDEX IF NOT EXISTS card_videos_microcontext_idx ON public.card_videos (user_id, microcontext_id, created_at DESC);