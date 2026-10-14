-- ============================================================================
-- CONTENT DB: RLS & MEDIA SECURITY TEST SUITE (Task 10.9)
-- ============================================================================
BEGIN;
SELECT plan(6);

-- 1. Verify RLS is enabled on content and media tables
SELECT tests.rls_enabled('public', 'titles');
SELECT tests.rls_enabled('public', 'episodes');
SELECT tests.rls_enabled('public', 'episode_media');

-- 2. Verify anon cannot access episode_media
SET LOCAL ROLE anon;
SELECT throws_ok(
  'SELECT * FROM public.episode_media',
  '42501',
  NULL,
  'anon must be blocked from selecting episode_media'
);

-- 3. Verify anon cannot access video_url column directly on episodes
SELECT throws_ok(
  'SELECT video_url FROM public.episodes',
  '42501',
  NULL,
  'anon must not have column grant on episodes.video_url'
);

-- 4. Verify authenticated also cannot select video_url directly
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  'SELECT video_url FROM public.episodes',
  '42501',
  NULL,
  'authenticated must not have column grant on episodes.video_url'
);

SELECT * FROM finish();
ROLLBACK;
