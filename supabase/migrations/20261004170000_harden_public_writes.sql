-- Public-facing writes must pass through server handlers that generate
-- confirmation tokens and derive user identity from authenticated claims.
REVOKE ALL PRIVILEGES ON public.blog_subscribers FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.blog_subscribers;
GRANT ALL PRIVILEGES ON public.blog_subscribers TO service_role;

-- Community audit eligibility is recorded only after a server-validated review.
REVOKE ALL PRIVILEGES ON public.flashcard_usage FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "own usage select" ON public.flashcard_usage;
DROP POLICY IF EXISTS "own usage insert" ON public.flashcard_usage;
GRANT ALL PRIVILEGES ON public.flashcard_usage TO service_role;

-- Comment throttling lives in the authenticated server handler. Direct table
-- access would let clients bypass the cooldown and daily limit by writing via
-- PostgREST, or erase the evidence used by those limits.
REVOKE ALL PRIVILEGES ON public.blog_comments FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Public sees visible comments" ON public.blog_comments;
DROP POLICY IF EXISTS "Users comment on published posts" ON public.blog_comments;
DROP POLICY IF EXISTS "Users edit own comments" ON public.blog_comments;
DROP POLICY IF EXISTS "Users delete own comments" ON public.blog_comments;
GRANT ALL PRIVILEGES ON public.blog_comments TO service_role;

-- Public pages need rating aggregates, not the identity of each reviewer.
REVOKE ALL PRIVILEGES ON public.blog_ratings FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS "Users rate published posts" ON public.blog_ratings;
DROP POLICY IF EXISTS "Users update own rating" ON public.blog_ratings;
DROP POLICY IF EXISTS "Users delete own rating" ON public.blog_ratings;
GRANT SELECT (post_id, stars) ON public.blog_ratings TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.blog_ratings TO service_role;
