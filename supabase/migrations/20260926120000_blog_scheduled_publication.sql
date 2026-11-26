-- Scheduled posts become publicly readable at their publish time, even if no
-- scheduled background worker is configured for this project.
DROP POLICY IF EXISTS "Published posts are public" ON public.blog_posts;
CREATE POLICY "Published posts are public" ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    OR (status = 'scheduled' AND published_at IS NOT NULL AND published_at <= now())
  );

DROP POLICY IF EXISTS "Public can read post translations" ON public.blog_post_translations;
CREATE POLICY "Public can read post translations" ON public.blog_post_translations
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = blog_post_translations.post_id
        AND (
          p.status = 'published'
          OR (p.status = 'scheduled' AND p.published_at IS NOT NULL AND p.published_at <= now())
        )
    )
  );

DROP POLICY IF EXISTS "Public sees visible comments" ON public.blog_comments;
CREATE POLICY "Public sees visible comments" ON public.blog_comments
  FOR SELECT TO anon, authenticated
  USING (
    hidden = false
    AND EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = blog_comments.post_id
        AND (
          p.status = 'published'
          OR (p.status = 'scheduled' AND p.published_at IS NOT NULL AND p.published_at <= now())
        )
    )
  );

DROP POLICY IF EXISTS "Users comment on published posts" ON public.blog_comments;
CREATE POLICY "Users comment on published posts" ON public.blog_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = blog_comments.post_id
        AND (
          p.status = 'published'
          OR (p.status = 'scheduled' AND p.published_at IS NOT NULL AND p.published_at <= now())
        )
    )
  );

DROP POLICY IF EXISTS "Public sees ratings" ON public.blog_ratings;
CREATE POLICY "Public sees ratings" ON public.blog_ratings
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = blog_ratings.post_id
        AND (
          p.status = 'published'
          OR (p.status = 'scheduled' AND p.published_at IS NOT NULL AND p.published_at <= now())
        )
    )
  );

DROP POLICY IF EXISTS "Users rate published posts" ON public.blog_ratings;
CREATE POLICY "Users rate published posts" ON public.blog_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.blog_posts p
      WHERE p.id = blog_ratings.post_id
        AND (
          p.status = 'published'
          OR (p.status = 'scheduled' AND p.published_at IS NOT NULL AND p.published_at <= now())
        )
    )
  );
