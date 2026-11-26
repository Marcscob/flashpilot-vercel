-- ============================================================
-- BLOG MULTILÍNGUE DO FLASHPILOT
-- ============================================================

-- Categorias do blog
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_categories TO anon;
GRANT SELECT ON public.blog_categories TO authenticated;
GRANT ALL ON public.blog_categories TO service_role;
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blog categories are public" ON public.blog_categories FOR SELECT TO anon, authenticated USING (true);

-- Traduções das categorias
CREATE TABLE IF NOT EXISTS public.blog_category_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.blog_categories(id) ON DELETE CASCADE,
  lang text NOT NULL,
  name text NOT NULL,
  UNIQUE(category_id, lang)
);
GRANT SELECT ON public.blog_category_translations TO anon;
GRANT SELECT ON public.blog_category_translations TO authenticated;
GRANT ALL ON public.blog_category_translations TO service_role;
ALTER TABLE public.blog_category_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blog category translations are public" ON public.blog_category_translations FOR SELECT TO anon, authenticated USING (true);

-- Posts do blog
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  cover_image_url text,
  category_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  featured boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  published_at timestamptz,
  reading_time_min integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published posts are public" ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published');
CREATE POLICY "Authors can see own drafts" ON public.blog_posts
  FOR SELECT TO authenticated
  USING (author_id = auth.uid());

-- Traduções dos posts
CREATE TABLE IF NOT EXISTS public.blog_post_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  lang text NOT NULL,
  title text NOT NULL,
  excerpt text,
  body_html text NOT NULL DEFAULT '',
  seo_title text,
  seo_description text,
  UNIQUE(post_id, lang)
);
GRANT SELECT ON public.blog_post_translations TO anon;
GRANT SELECT ON public.blog_post_translations TO authenticated;
GRANT ALL ON public.blog_post_translations TO service_role;
ALTER TABLE public.blog_post_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read post translations" ON public.blog_post_translations
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_post_translations.post_id AND p.status = 'published')
  );

-- Inscritos na newsletter (dupla confirmação LGPD)
CREATE TABLE IF NOT EXISTS public.blog_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text,
  lang text NOT NULL DEFAULT 'pt',
  confirmed_at timestamptz,
  confirmation_token text,
  unsubscribe_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.blog_subscribers TO anon;
GRANT INSERT ON public.blog_subscribers TO authenticated;
GRANT SELECT ON public.blog_subscribers TO authenticated;
GRANT ALL ON public.blog_subscribers TO service_role;
ALTER TABLE public.blog_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON public.blog_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Comentários
CREATE TABLE IF NOT EXISTS public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comments TO authenticated;
GRANT ALL ON public.blog_comments TO service_role;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public sees visible comments" ON public.blog_comments
  FOR SELECT TO anon, authenticated
  USING (
    hidden = false
    AND EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_comments.post_id AND p.status = 'published')
  );
CREATE POLICY "Users comment on published posts" ON public.blog_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_comments.post_id AND p.status = 'published')
  );
CREATE POLICY "Users edit own comments" ON public.blog_comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own comments" ON public.blog_comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Avaliações (1–5 estrelas, uma por usuário por post)
CREATE TABLE IF NOT EXISTS public.blog_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars smallint NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
GRANT SELECT ON public.blog_ratings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_ratings TO authenticated;
GRANT ALL ON public.blog_ratings TO service_role;
ALTER TABLE public.blog_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public sees ratings" ON public.blog_ratings
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ratings.post_id AND p.status = 'published')
  );
CREATE POLICY "Users rate published posts" ON public.blog_ratings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.blog_posts p WHERE p.id = blog_ratings.post_id AND p.status = 'published')
  );
CREATE POLICY "Users update own rating" ON public.blog_ratings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own rating" ON public.blog_ratings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Triggers de updated_at (reutiliza a função existente)
CREATE TRIGGER update_blog_categories_updated_at BEFORE UPDATE ON public.blog_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_blog_subscribers_updated_at BEFORE UPDATE ON public.blog_subscribers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_blog_comments_updated_at BEFORE UPDATE ON public.blog_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_blog_ratings_updated_at BEFORE UPDATE ON public.blog_ratings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Categoria padrão
INSERT INTO public.blog_categories (slug) VALUES ('geral') ON CONFLICT DO NOTHING;
INSERT INTO public.blog_category_translations (category_id, lang, name)
  SELECT c.id, lang, name FROM public.blog_categories c
  CROSS JOIN (VALUES ('pt', 'Geral'), ('pt-PT', 'Geral'), ('en', 'General'), ('es', 'General'), ('fr', 'Général'), ('it', 'Generale'), ('de', 'Allgemein')) AS t(lang, name)
  WHERE c.slug = 'geral'
  ON CONFLICT DO NOTHING;