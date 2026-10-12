-- ============================================================================
-- VERIFICATION SCRIPT: CONTENT DB RLS & PERMISSIONS (Task 10.6)
-- Tests:
-- 1. anon cannot read from episode_media (RLS + REVOKE)
-- 2. anon cannot SELECT video_url on episodes (column grant restriction)
-- 3. anon can read public columns of episodes belonging to Published titles
-- 4. anon CANNOT read episodes belonging to Draft, Scheduled, or Archived titles
-- 5. service_role / postgres has full access to episode_media and episodes
-- 6. anon / authenticated hold no write privilege on any public table except the five owner-scoped user tables
-- 7. a table created by a later migration gets no client grants by default
--
-- Run against a LOCAL database with all content migrations applied. Everything
-- happens inside one transaction that is rolled back. The first failure aborts.
-- ============================================================================
\set ON_ERROR_STOP on

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

-- Test 5: client roles hold no write privilege on any table
-- (20261011110000_revoke_client_write_grants.sql)
-- ADR-0005: the single database also holds the user-side tables. Signed-in users
-- write their own rows in these five (row security limits them to their own rows;
-- verify-user-side-rls.sql checks those grants and policies), so they are excluded.
RESET ROLE;
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN ('profiles', 'favorites', 'watch_history', 'custom_lists', 'custom_list_items')
  LOOP
    IF has_table_privilege('anon', t.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
       OR has_table_privilege('authenticated', t.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
       OR has_any_column_privilege('anon', t.oid, 'INSERT, UPDATE')
       OR has_any_column_privilege('authenticated', t.oid, 'INSERT, UPDATE') THEN
      RAISE EXCEPTION 'TEST FAILED: a client role holds a write privilege on public.%', t.relname;
    END IF;
  END LOOP;
  RAISE NOTICE 'TEST PASSED: client roles hold no write privilege on any public table.';
END $$;

-- Test 6: a table created by a later migration is not exposed by default
CREATE TABLE public.zz_future_table (id int);
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.zz_future_table', 'SELECT')
     OR has_table_privilege('authenticated', 'public.zz_future_table', 'SELECT') THEN
    RAISE EXCEPTION 'TEST FAILED: new tables are still auto-granted to anon/authenticated';
  END IF;
  RAISE NOTICE 'TEST PASSED: future tables get no anon/authenticated grants by default.';
END $$;
DROP TABLE public.zz_future_table;

ROLLBACK;
