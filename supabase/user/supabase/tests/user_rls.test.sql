-- ============================================================================
-- USER DB: RLS & SECURITY TEST SUITE (Task 10.9)
-- ============================================================================
BEGIN;
SELECT plan(8);

-- 1. Verify RLS is enabled on all sensitive user tables
SELECT tests.rls_enabled('public', 'profiles');
SELECT tests.rls_enabled('public', 'favorites');
SELECT tests.rls_enabled('public', 'watch_history');
SELECT tests.rls_enabled('public', 'custom_lists');
SELECT tests.rls_enabled('public', 'custom_list_items');

-- 2. Verify anon cannot read user profiles
SET LOCAL ROLE anon;
SELECT throws_ok(
  'SELECT * FROM public.profiles',
  '42501',
  NULL,
  'anon must be blocked from selecting profiles'
);

-- 3. Verify authenticated cannot update role on profiles
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  'UPDATE public.profiles SET role = ''admin'' WHERE id = gen_random_uuid()',
  '42501',
  NULL,
  'authenticated user must not be granted UPDATE on profiles.role column'
);

-- 4. Verify cross-user isolation
-- Authenticated user cannot insert into favorites with arbitrary user_id
SELECT throws_ok(
  'INSERT INTO public.favorites (user_id, title_slug) VALUES (gen_random_uuid(), ''test-drama'')',
  '42501',
  NULL,
  'authenticated user cannot plant favorites for another user_id'
);

SELECT * FROM finish();
ROLLBACK;
