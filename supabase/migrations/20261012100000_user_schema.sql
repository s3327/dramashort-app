-- Ported from the dramashort-user chain (20260930150000_user_schema.sql) by ADR-0005.
-- The single project is built from this chain (ADR-0005); this file runs after the catalog chain.
-- ============================================================================
-- USER & ENGAGEMENT DATABASE SCHEMA (Project 2: DramaShort App Specific)
-- ============================================================================

-- 1. PROFILES TABLE (Syncs with Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to create profile record when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. FAVORITES TABLE (Stores drama slug from Content DB)
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_slug TEXT NOT NULL,               -- e.g. "ceo-secret-wife-ds"
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, title_slug)
);

-- 3. WATCH HISTORY / CONTINUE WATCHING
CREATE TABLE IF NOT EXISTS watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_slug TEXT NOT NULL,               -- e.g. "ceo-secret-wife-ds"
  episode_number INT NOT NULL DEFAULT 1,
  progress FLOAT NOT NULL DEFAULT 0.0 CHECK (progress >= 0.0 AND progress <= 1.0),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, title_slug)
);

-- 4. CUSTOM LISTS
CREATE TABLE IF NOT EXISTS custom_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CUSTOM LIST ITEMS
CREATE TABLE IF NOT EXISTS custom_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES custom_lists(id) ON DELETE CASCADE,
  title_slug TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, title_slug)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_user_id ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_lists_user_id ON custom_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_list_items_list_id ON custom_list_items(list_id);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
CREATE POLICY "Users can manage own profile" ON profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;
CREATE POLICY "Users can manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own history" ON watch_history;
CREATE POLICY "Users can manage own history" ON watch_history FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own lists" ON custom_lists;
CREATE POLICY "Users can manage own lists" ON custom_lists FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own list items" ON custom_list_items;
CREATE POLICY "Users can manage own list items" ON custom_list_items FOR ALL USING (
  EXISTS (SELECT 1 FROM custom_lists WHERE id = custom_list_items.list_id AND user_id = auth.uid())
);
