CREATE OR REPLACE FUNCTION public.save_blog_post(
  p_post_id uuid,
  p_post jsonb,
  p_author_id uuid,
  p_translations jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  saved_post_id uuid;
BEGIN
  IF p_post_id IS NULL THEN
    INSERT INTO public.blog_posts (
      slug, cover_image_url, category_id, featured, status,
      published_at, author_id, reading_time_min
    )
    VALUES (
      p_post->>'slug',
      p_post->>'cover_image_url',
      NULLIF(p_post->>'category_id', '')::uuid,
      COALESCE((p_post->>'featured')::boolean, false),
      COALESCE(p_post->>'status', 'draft'),
      NULLIF(p_post->>'published_at', '')::timestamptz,
      p_author_id,
      COALESCE((p_post->>'reading_time_min')::integer, 1)
    )
    RETURNING id INTO saved_post_id;
  ELSE
    UPDATE public.blog_posts
    SET
      slug = CASE WHEN p_post ? 'slug' THEN p_post->>'slug' ELSE slug END,
      cover_image_url = CASE WHEN p_post ? 'cover_image_url' THEN p_post->>'cover_image_url' ELSE cover_image_url END,
      category_id = CASE WHEN p_post ? 'category_id' THEN NULLIF(p_post->>'category_id', '')::uuid ELSE category_id END,
      featured = CASE WHEN p_post ? 'featured' THEN (p_post->>'featured')::boolean ELSE featured END,
      status = CASE WHEN p_post ? 'status' THEN p_post->>'status' ELSE status END,
      published_at = CASE
        WHEN p_post->>'status' = 'published' THEN now()
        WHEN p_post ? 'published_at' THEN NULLIF(p_post->>'published_at', '')::timestamptz
        ELSE published_at
      END,
      reading_time_min = CASE
        WHEN p_post ? 'reading_time_min' THEN (p_post->>'reading_time_min')::integer
        ELSE reading_time_min
      END
    WHERE id = p_post_id
    RETURNING id INTO saved_post_id;

    IF saved_post_id IS NULL THEN
      RAISE EXCEPTION 'Blog post not found';
    END IF;
  END IF;

  IF jsonb_typeof(p_translations) = 'array' AND jsonb_array_length(p_translations) > 0 THEN
    INSERT INTO public.blog_post_translations (
      post_id, lang, title, excerpt, body_html, seo_title, seo_description
    )
    SELECT
      saved_post_id, item.lang, item.title, item.excerpt,
      COALESCE(item.body_html, ''), item.seo_title, item.seo_description
    FROM jsonb_to_recordset(p_translations) AS item(
      lang text, title text, excerpt text, body_html text,
      seo_title text, seo_description text
    )
    ON CONFLICT (post_id, lang) DO UPDATE SET
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      body_html = EXCLUDED.body_html,
      seo_title = EXCLUDED.seo_title,
      seo_description = EXCLUDED.seo_description;
  END IF;

  RETURN saved_post_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_blog_post(uuid, jsonb, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_blog_post(uuid, jsonb, uuid, jsonb) TO service_role;
