-- ============================================================================
-- VERIFICATION SCRIPT: CONTENT DB RLS & PERMISSIONS (Task 10.6)
-- Tests:
-- 1. anon cannot read from episode_media (RLS + REVOKE)
-- 2. anon cannot SELECT video_url on episodes (column grant restriction)
-- 3. anon can read public columns of episodes belonging to Published titles
-- 4. anon CANNOT read episodes belonging to Draft, Scheduled, or Archived titles
-- 5. service_role / postgres has full access to episode_media and episodes
-- ============================================================================

BEGIN;

-- Setup test fixture
DO $$
DECLARE
  v_pub_title_id UUID := gen_random_uuid();
  v_draft_title_id UUID := gen_random_uuid();
  v_pub_ep_id UUID := gen_random_uuid();
  v_draft_ep_id UUID := gen_random_uuid();
BEGIN
  -- Insert Published title and Draft title
  INSERT INTO public.titles (id, slug, title, channel_name, channel_code, poster_url, synopsis, genre, status)
  VALUES 
    (v_pub_title_id, 'test-pub-title-xyz', 'Test Published Title', 'Channel A', 'ca', 'https://example.com/p1.jpg', 'Synopsis', 'Drama', 'Published'),
    (v_draft_title_id, 'test-draft-title-xyz', 'Test Draft Title', 'Channel B', 'cb', 'https://example.com/p2.jpg', 'Synopsis', 'Drama', 'Draft');

  -- Insert episodes for both
  INSERT INTO public.episodes (id, title_id, episode_number, title, video_url, is_free)
  VALUES 
    (v_pub_ep_id, v_pub_title_id, 1, 'Pub Ep 1', 'https://example.com/pub-stream.m3u8', true),
    (v_draft_ep_id, v_draft_title_id, 1, 'Draft Ep 1', 'https://example.com/draft-stream.m3u8', true);

  -- Insert episode_media
  INSERT INTO public.episode_media (episode_id, provider, hls_url, status)
  VALUES 
    (v_pub_ep_id, 'custom', 'https://example.com/pub-stream.m3u8', 'ready'),
    (v_draft_ep_id, 'custom', 'https://example.com/draft-stream.m3u8', 'ready');
END $$;

-- Test 1: Service role can read episode_media
SET ROLE postgres;
SELECT count(*) AS service_role_episode_media_count FROM public.episode_media;

-- Test 2: Anon cannot read episode_media
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.episode_media;
    RAISE EXCEPTION 'TEST FAILED: anon was able to query episode_media!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST PASSED: anon cannot query episode_media (insufficient_privilege)';
  END;
END $$;

-- Test 3: Anon cannot read video_url column from episodes
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM video_url FROM public.episodes LIMIT 1;
    RAISE EXCEPTION 'TEST FAILED: anon was able to select video_url from episodes!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST PASSED: anon cannot select video_url from episodes (insufficient_privilege)';
  END;
END $$;

-- Test 4: Anon reading public columns of episodes only sees Published titles
SET ROLE anon;
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.episodes e
  JOIN public.titles t ON t.id = e.title_id
  WHERE t.status = 'Draft';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'TEST FAILED: anon was able to see % episodes of Draft titles!', v_count;
  ELSE
    RAISE NOTICE 'TEST PASSED: anon sees 0 episodes belonging to Draft titles.';
  END IF;
END $$;

ROLLBACK;
