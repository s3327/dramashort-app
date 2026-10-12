-- ============================================================================
-- User DB RLS & privilege verification (Task 10.2; basis for Task 10.9 tests)
-- ============================================================================
-- Run against a LOCAL database with all user migrations applied. It creates and
-- deletes two throwaway auth users (A, B). Never run against production.
--
--   docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q \
--     < scripts/sql/verify-user-side-rls.sql
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

-- privileged SECURITY DEFINER procedures are callable by service_role only
-- (20261010110000_lock_down_function_execute.sql)
DO $$
DECLARE
  fn RECORD;
  n int := 0;
BEGIN
  FOR fn IN
    SELECT p.oid, p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.proname IN (
        'ensure_user_wallet', 'credit_wallet_coins', 'debit_wallet_coins',
        'unlock_episode_with_coins', 'claim_daily_checkin',
        'fulfill_payment_order', 'rollup_daily_playback_stats'
      )
  LOOP
    n := n + 1;
    IF has_function_privilege('anon', fn.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', fn.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL % is executable by anon/authenticated', fn.signature;
    END IF;
    IF NOT has_function_privilege('service_role', fn.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL % is not executable by service_role', fn.signature;
    END IF;
  END LOOP;
  IF n < 7 THEN
    RAISE EXCEPTION 'FAIL expected 7 privileged procedures, found %', n;
  END IF;
  RAISE NOTICE 'PASS wallet, payment and rollup procedures are service_role only';
END $$;

-- default privileges: a function created by a later migration is not client-callable
CREATE FUNCTION public.zz_future_fn() RETURNS int LANGUAGE sql AS 'SELECT 1';
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.zz_future_fn()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.zz_future_fn()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL new functions are still auto-granted to anon/authenticated';
  END IF;
  RAISE NOTICE 'PASS future functions get no anon/authenticated EXECUTE by default';
END $$;
DROP FUNCTION public.zz_future_fn();

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

  -- payment_orders and payment_webhook_events privilege boundaries
  BEGIN
    INSERT INTO public.payment_orders (user_id, package_id, amount_minor, currency, provider)
    VALUES (auth.uid(), 'coins_starter_100', 99, 'USD', 'hacked');
    RAISE EXCEPTION 'FAIL authenticated user inserted directly into payment_orders';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated user cannot insert into payment_orders';
  END;

  BEGIN
    SELECT count(*) FROM public.payment_webhook_events;
    RAISE EXCEPTION 'FAIL authenticated user selected from payment_webhook_events';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated user cannot access payment_webhook_events';
  END;

  -- wallet procedures cannot be called directly by a signed-in client
  BEGIN
    PERFORM public.credit_wallet_coins(auth.uid(), 1000000, 'admin_grant');
    RAISE EXCEPTION 'FAIL authenticated user minted coins via credit_wallet_coins';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated user cannot execute credit_wallet_coins';
  END;

  BEGIN
    PERFORM public.fulfill_payment_order(gen_random_uuid());
    RAISE EXCEPTION 'FAIL authenticated user executed fulfill_payment_order';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS authenticated user cannot execute fulfill_payment_order';
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
  FOREACH t IN ARRAY ARRAY['profiles','favorites','watch_history','custom_lists','custom_list_items','payment_orders','payment_webhook_events','wallets','coin_transactions'] LOOP
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
