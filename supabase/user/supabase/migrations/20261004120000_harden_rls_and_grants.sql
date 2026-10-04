-- ============================================================================
-- TASK 10.2: USER DATABASE RLS & COLUMN-LEVEL PRIVILEGE HARDENING
-- ============================================================================
-- Before this migration, profiles had a single FOR ALL policy and the
-- authenticated role had GRANT ALL on every table, so any signed-in user could
-- run `update profiles set role = 'admin'` on their own row (and would be able
-- to edit any column added to profiles later, such as Phase 8 wallet fields).

-- ----------------------------------------------------------------------------
-- 1. Default privileges
-- ----------------------------------------------------------------------------
-- Tables and sequences created by future migrations are no longer readable or
-- writable by anon/authenticated until that migration grants access explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Table grants
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE
  public.profiles,
  public.favorites,
  public.watch_history,
  public.custom_lists,
  public.custom_list_items
FROM anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- profiles: rows are created by handle_new_user() and removed by cascade, so
-- users only read their row and edit display fields. role is not writable.
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name, avatar_url, updated_at) ON TABLE public.profiles TO authenticated;

-- Engagement tables: full DML, limited to the user's own rows by RLS below.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.favorites,
  public.watch_history,
  public.custom_lists,
  public.custom_list_items
TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. Row level security policies (per command, explicit WITH CHECK)
-- ----------------------------------------------------------------------------
-- `(select auth.uid())` is evaluated once per statement instead of once per row.

-- profiles
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- favorites
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users read own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users insert own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users update own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Users delete own favorites" ON public.favorites;

CREATE POLICY "Users read own favorites" ON public.favorites
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users insert own favorites" ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users update own favorites" ON public.favorites
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users delete own favorites" ON public.favorites
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- watch_history
DROP POLICY IF EXISTS "Users can manage own history" ON public.watch_history;
DROP POLICY IF EXISTS "Users read own history" ON public.watch_history;
DROP POLICY IF EXISTS "Users insert own history" ON public.watch_history;
DROP POLICY IF EXISTS "Users update own history" ON public.watch_history;
DROP POLICY IF EXISTS "Users delete own history" ON public.watch_history;

CREATE POLICY "Users read own history" ON public.watch_history
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users insert own history" ON public.watch_history
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users update own history" ON public.watch_history
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users delete own history" ON public.watch_history
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- custom_lists
DROP POLICY IF EXISTS "Users can manage own lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users read own lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users insert own lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users update own lists" ON public.custom_lists;
DROP POLICY IF EXISTS "Users delete own lists" ON public.custom_lists;

CREATE POLICY "Users read own lists" ON public.custom_lists
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY "Users insert own lists" ON public.custom_lists
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users update own lists" ON public.custom_lists
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users delete own lists" ON public.custom_lists
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- custom_list_items: ownership comes from the parent list. WITH CHECK also
-- stops a user from inserting into, or moving an item to, someone else's list.
DROP POLICY IF EXISTS "Users can manage own list items" ON public.custom_list_items;
DROP POLICY IF EXISTS "Users read own list items" ON public.custom_list_items;
DROP POLICY IF EXISTS "Users insert own list items" ON public.custom_list_items;
DROP POLICY IF EXISTS "Users update own list items" ON public.custom_list_items;
DROP POLICY IF EXISTS "Users delete own list items" ON public.custom_list_items;

CREATE POLICY "Users read own list items" ON public.custom_list_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.custom_lists l
    WHERE l.id = custom_list_items.list_id AND l.user_id = (select auth.uid())
  ));
CREATE POLICY "Users insert own list items" ON public.custom_list_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.custom_lists l
    WHERE l.id = custom_list_items.list_id AND l.user_id = (select auth.uid())
  ));
CREATE POLICY "Users update own list items" ON public.custom_list_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.custom_lists l
    WHERE l.id = custom_list_items.list_id AND l.user_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.custom_lists l
    WHERE l.id = custom_list_items.list_id AND l.user_id = (select auth.uid())
  ));
CREATE POLICY "Users delete own list items" ON public.custom_list_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.custom_lists l
    WHERE l.id = custom_list_items.list_id AND l.user_id = (select auth.uid())
  ));

-- ----------------------------------------------------------------------------
-- 4. SECURITY DEFINER function hardening
-- ----------------------------------------------------------------------------
-- A fixed, empty search_path prevents a caller-controlled schema from shadowing
-- the objects this function uses. All references below are schema-qualified.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    'user'
  );
  RETURN NEW;
END;
$$;
