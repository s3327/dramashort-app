-- ============================================================================
-- User DB RLS & privilege verification (Task 10.2; basis for Task 10.9 tests)
-- ============================================================================
-- Run against a LOCAL database with all user migrations applied. It creates and
-- deletes two throwaway auth users (A, B). Never run against production.
--
--   docker exec -i supabase_db_user psql -U postgres -d postgres -q \
--     < scripts/sql/verify-user-db-rls.sql
--
-- Every check prints NOTICE 'PASS ...'; the first failure aborts with 'FAIL ...'.
-- Final line on success: ALL TASK 10.2 CHECKS PASSED
\set ON_ERROR_STOP on
\set A '11111111-1111-1111-1111-111111111111'
\set B '22222222-2222-2222-2222-222222222222'

-- ---------------------------------------------------------------- setup (postgres)
DELETE FROM auth.users WHERE id IN (:'A', :'B');
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES (:'A', 'a@test.local', '{"full_name":"User A"}'),
       (:'B', 'b@test.local', '{}');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.profiles
      WHERE id IN ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222')) <> 2 THEN
    RAISE EXCEPTION 'FAIL signup trigger did not create both profiles';
  END IF;
  IF (SELECT display_name FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222') <> 'b' THEN
    RAISE EXCEPTION 'FAIL trigger fallback display_name';
  END IF;
  RAISE NOTICE 'PASS handle_new_user() creates profiles (search_path = '''')';
END $$;

INSERT INTO public.favorites (user_id, title_slug) VALUES (:'B', 'b-secret-fav');
INSERT INTO public.watch_history (user_id, title_slug, episode_number, progress) VALUES (:'B', 'b-show', 3, 0.4);
INSERT INTO public.custom_lists (id, user_id, title) VALUES ('33333333-3333-3333-3333-333333333333', :'B', 'B list');
INSERT INTO public.custom_lists (id, user_id, title) VALUES ('44444444-4444-4444-4444-444444444444', :'A', 'A list');
INSERT INTO public.custom_list_items (list_id, title_slug) VALUES ('33333333-3333-3333-3333-333333333333', 'b-item');

-- default privileges: a table created by a later migration is not exposed
CREATE TABLE public.zz_future_table (id int);
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.zz_future_table', 'SELECT')
     OR has_table_privilege('anon', 'public.zz_future_table', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL new tables are still auto-granted to anon/authenticated';
  END IF;
  RAISE NOTICE 'PASS future tables get no anon/authenticated grants by default';
END $$;
DROP TABLE public.zz_future_table;

-- ---------------------------------------------------------------- as user A
BEGIN;
SET LOCAL ROLE authenticated;
-- Set both forms: newer auth.uid() reads request.jwt.claims, the legacy one in
-- an un-migrated local image reads request.jwt.claim.sub.
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true),
       set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
DO $$
BEGIN
  IF auth.uid() IS DISTINCT FROM '11111111-1111-1111-1111-111111111111'::uuid THEN
    RAISE EXCEPTION 'FAIL test harness: auth.uid() is %, expected user A', auth.uid();
  END IF;
END $$;

DO $$
DECLARE n int;
BEGIN
  -- privilege escalation via profiles.role
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL user could update profiles.role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS user cannot update profiles.role';
  END;

  -- allowed profile edit (mirrors updateUserProfile())
  UPDATE public.profiles SET display_name = 'A renamed', avatar_url = NULL, updated_at = now() WHERE id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL user could not update own display_name'; END IF;
  RAISE NOTICE 'PASS user can update own display_name / avatar_url / updated_at';

  -- cannot touch another profile
  UPDATE public.profiles SET display_name = 'hacked' WHERE id = '22222222-2222-2222-2222-222222222222';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user updated another profile'; END IF;
  RAISE NOTICE 'PASS user cannot update another user''s profile';

  BEGIN
    INSERT INTO public.profiles (id, role) VALUES (gen_random_uuid(), 'admin');
    RAISE EXCEPTION 'FAIL user could insert a profile';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS user cannot insert profiles';
  END;

  BEGIN
    DELETE FROM public.profiles WHERE id = auth.uid();
    RAISE EXCEPTION 'FAIL user could delete a profile';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS user cannot delete profiles';
  END;

  SELECT count(*) INTO n FROM public.profiles;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL user sees % profiles (expected 1)', n; END IF;
  RAISE NOTICE 'PASS user sees only own profile';

  -- favorites
  SELECT count(*) INTO n FROM public.favorites;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user can read another user''s favorites'; END IF;
  RAISE NOTICE 'PASS user cannot read another user''s favorites';

  INSERT INTO public.favorites (user_id, title_slug) VALUES (auth.uid(), 'a-fav')
  ON CONFLICT (user_id, title_slug) DO UPDATE SET title_slug = EXCLUDED.title_slug;
  INSERT INTO public.favorites (user_id, title_slug) VALUES (auth.uid(), 'a-fav')
  ON CONFLICT (user_id, title_slug) DO UPDATE SET title_slug = EXCLUDED.title_slug;
  RAISE NOTICE 'PASS user can upsert own favorite (insert + conflict update)';

  BEGIN
    INSERT INTO public.favorites (user_id, title_slug) VALUES ('22222222-2222-2222-2222-222222222222', 'planted');
    RAISE EXCEPTION 'FAIL user inserted a favorite for another user';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS user cannot insert favorites for another user';
  END;

  BEGIN
    UPDATE public.favorites SET user_id = '22222222-2222-2222-2222-222222222222' WHERE user_id = auth.uid();
    RAISE EXCEPTION 'FAIL user reassigned own favorite to another user';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS user cannot reassign own favorite to another user';
  END;

  DELETE FROM public.favorites WHERE user_id = '22222222-2222-2222-2222-222222222222';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user deleted another user''s favorites'; END IF;
  RAISE NOTICE 'PASS user cannot delete another user''s favorites';

  -- watch history
  SELECT count(*) INTO n FROM public.watch_history;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user can read another user''s history'; END IF;
  INSERT INTO public.watch_history (user_id, title_slug, episode_number, progress)
  VALUES (auth.uid(), 'a-show', 1, 0.1)
  ON CONFLICT (user_id, title_slug) DO UPDATE SET progress = EXCLUDED.progress;
  INSERT INTO public.watch_history (user_id, title_slug, episode_number, progress)
  VALUES (auth.uid(), 'a-show', 2, 0.5)
  ON CONFLICT (user_id, title_slug) DO UPDATE SET progress = EXCLUDED.progress, episode_number = EXCLUDED.episode_number;
  DELETE FROM public.watch_history WHERE user_id = '22222222-2222-2222-2222-222222222222';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user deleted another user''s history'; END IF;
  RAISE NOTICE 'PASS watch history isolated; own upsert works';

  -- custom lists and items
  SELECT count(*) INTO n FROM public.custom_lists;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL user sees % lists (expected 1)', n; END IF;
  SELECT count(*) INTO n FROM public.custom_list_items;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL user can read another user''s list items'; END IF;

  INSERT INTO public.custom_lists (user_id, title) VALUES (auth.uid(), 'A second list');
  INSERT INTO public.custom_list_items (list_id, title_slug) VALUES ('44444444-4444-4444-4444-444444444444', 'a-item')
  ON CONFLICT (list_id, title_slug) DO UPDATE SET title_slug = EXCLUDED.title_slug;

  BEGIN
    INSERT INTO public.custom_list_items (list_id, title_slug) VALUES ('33333333-3333-3333-3333-333333333333', 'planted');
    RAISE EXCEPTION 'FAIL user inserted into another user''s list';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS user cannot insert items into another user''s list';
  END;

  BEGIN
    UPDATE public.custom_list_items SET list_id = '33333333-3333-3333-3333-333333333333'
    WHERE list_id = '44444444-4444-4444-4444-444444444444';
    RAISE EXCEPTION 'FAIL user moved an item into another user''s list';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS user cannot move items into another user''s list';
  END;

  RAISE NOTICE 'PASS custom lists and items isolated; own list + item upsert works';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------- as anon
BEGIN;
SET LOCAL ROLE anon;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','favorites','watch_history','custom_lists','custom_list_items'] LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', t);
      RAISE EXCEPTION 'FAIL anon can select from %', t;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
  RAISE NOTICE 'PASS anon has no access to any user table';
END $$;
ROLLBACK;

-- ---------------------------------------------------------------- cleanup
DELETE FROM auth.users WHERE id IN (:'A', :'B');
SELECT 'ALL TASK 10.2 CHECKS PASSED' AS result;
