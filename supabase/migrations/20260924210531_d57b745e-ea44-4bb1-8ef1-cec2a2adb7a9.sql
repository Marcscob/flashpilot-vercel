DROP POLICY IF EXISTS "Anyone can subscribe" ON public.blog_subscribers;
CREATE POLICY "Anyone can subscribe" ON public.blog_subscribers FOR INSERT TO anon, authenticated
WITH CHECK (
  email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(email) <= 254
  AND (name IS NULL OR length(name) <= 120)
  AND lang IN ('en','es','fr','it','de','pt-BR','pt-PT','pt')
  AND confirmed_at IS NULL
);
DROP POLICY IF EXISTS "Blog categories are public" ON public.blog_categories;
CREATE POLICY "Blog categories are public" ON public.blog_categories FOR SELECT TO anon, authenticated
USING (slug IS NOT NULL AND length(slug) > 0);
DROP POLICY IF EXISTS "Blog category translations are public" ON public.blog_category_translations;
CREATE POLICY "Blog category translations are public" ON public.blog_category_translations FOR SELECT TO anon, authenticated
USING (lang IN ('en','es','fr','it','de','pt-BR','pt-PT','pt'));