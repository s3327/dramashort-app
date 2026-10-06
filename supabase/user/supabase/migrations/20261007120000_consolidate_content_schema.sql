-- ============================================================================
-- CONSOLIDATE CONTENT SCHEMA (Task 13.2: Option A Database Consolidation)
-- ADR-0003: Single Supabase Project with `content` & `public` Schemas
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CREATE `content` SCHEMA & GRANT BASE USAGE PRIVILEGES
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS content;

-- Grant schema usage to standard Supabase roles so PostgREST and Auth can access it
GRANT USAGE ON SCHEMA content TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. CREATE `content` SCHEMA TABLES
-- ----------------------------------------------------------------------------

-- 2.1 CHANNELS TABLE
CREATE TABLE IF NOT EXISTS content.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,               -- e.g. "velvet-frame"
  code VARCHAR(10) UNIQUE NOT NULL,        -- e.g. "vf", "ds" (2-5 chars acronym)
  description TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 TITLES (DRAMAS) TABLE
CREATE TABLE IF NOT EXISTS content.titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,               -- e.g. "reborn-to-ruin-him-vf"
  title TEXT NOT NULL,
  channel_id UUID REFERENCES content.channels(id) ON DELETE SET NULL,
  channel_name TEXT NOT NULL,
  channel_code VARCHAR(10) NOT NULL,
  poster_url TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  genre TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  total_episodes INT NOT NULL DEFAULT 1,
  episodes_available INT NOT NULL DEFAULT 0,
  rating NUMERIC(2, 1) DEFAULT 0.0,
  views_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Scheduled', 'Archived')),
  release_year INT DEFAULT EXTRACT(YEAR FROM now()),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 EPISODES TABLE
CREATE TABLE IF NOT EXISTS content.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id UUID NOT NULL REFERENCES content.titles(id) ON DELETE CASCADE,
  episode_number INT NOT NULL,
  title TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INT DEFAULT 0,
  is_free BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(title_id, episode_number)
);

-- 2.4 EPISODE MEDIA TABLE (Gated playback manifests and raw URLs)
CREATE TABLE IF NOT EXISTS content.episode_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES content.episodes(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'custom',
  asset_ref TEXT,
  hls_url TEXT,
  mp4_url TEXT,
  duration_seconds INT DEFAULT 0,
  aspect_ratio TEXT DEFAULT '9:16',
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(episode_id, provider)
);

-- ----------------------------------------------------------------------------
-- 3. INDEXES ON `content` TABLES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_content_titles_slug ON content.titles(slug);
CREATE INDEX IF NOT EXISTS idx_content_titles_channel_code ON content.titles(channel_code);
CREATE INDEX IF NOT EXISTS idx_content_titles_genre ON content.titles(genre);
CREATE INDEX IF NOT EXISTS idx_content_titles_status_views ON content.titles(status, views_count DESC);
CREATE INDEX IF NOT EXISTS idx_content_titles_status_created ON content.titles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_episodes_title_id ON content.episodes(title_id);
CREATE INDEX IF NOT EXISTS idx_content_episode_media_episode_id ON content.episode_media(episode_id);

-- ----------------------------------------------------------------------------
-- 4. INTEGRITY FUNCTIONS & TRIGGERS ON `content` TABLES
-- ----------------------------------------------------------------------------

-- 4.1 Trigger: Automatically compute episodes_available on content.episodes mutations
CREATE OR REPLACE FUNCTION content.sync_title_episodes_available()
RETURNS TRIGGER AS $$
DECLARE
  v_title_id UUID;
  v_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_title_id := OLD.title_id;
  ELSE
    v_title_id := NEW.title_id;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM content.episodes
  WHERE title_id = v_title_id;

  UPDATE content.titles
  SET episodes_available = v_count
  WHERE id = v_title_id;

  -- Handle case where UPDATE changes title_id across titles
  IF TG_OP = 'UPDATE' AND OLD.title_id IS DISTINCT FROM NEW.title_id THEN
    SELECT COUNT(*) INTO v_count
    FROM content.episodes
    WHERE title_id = OLD.title_id;

    UPDATE content.titles
    SET episodes_available = v_count
    WHERE id = OLD.title_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_title_episodes_available ON content.episodes;
CREATE TRIGGER trg_sync_title_episodes_available
AFTER INSERT OR UPDATE OR DELETE ON content.episodes
FOR EACH ROW
EXECUTE FUNCTION content.sync_title_episodes_available();

-- 4.2 Trigger: Keep channel_name and channel_code on content.titles synchronized when a channel is updated
CREATE OR REPLACE FUNCTION content.sync_channel_to_titles()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name OR NEW.code IS DISTINCT FROM OLD.code THEN
    UPDATE content.titles
    SET 
      channel_name = NEW.name,
      channel_code = NEW.code
    WHERE channel_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_channel_to_titles ON content.channels;
CREATE TRIGGER trg_sync_channel_to_titles
AFTER UPDATE OF name, code ON content.channels
FOR EACH ROW
EXECUTE FUNCTION content.sync_channel_to_titles();

-- 4.3 Trigger: Auto-populate channel_name and channel_code from channel_id on INSERT/UPDATE of content.titles
CREATE OR REPLACE FUNCTION content.sync_title_channel_from_fk()
RETURNS TRIGGER AS $$
DECLARE
  v_channel RECORD;
BEGIN
  IF NEW.channel_id IS NOT NULL THEN
    SELECT name, code INTO v_channel
    FROM content.channels
    WHERE id = NEW.channel_id;

    IF FOUND THEN
      NEW.channel_name := v_channel.name;
      NEW.channel_code := v_channel.code;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_title_channel_from_fk ON content.titles;
CREATE TRIGGER trg_sync_title_channel_from_fk
BEFORE INSERT OR UPDATE OF channel_id ON content.titles
FOR EACH ROW
WHEN (NEW.channel_id IS NOT NULL)
EXECUTE FUNCTION content.sync_title_channel_from_fk();

-- 4.4 Trigger: Enforce slug immutability once a drama has been published
CREATE OR REPLACE FUNCTION content.enforce_title_slug_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- If drama status was Published, slug cannot be modified
  IF OLD.status = 'Published' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'Slug cannot be modified once a drama has been published';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_title_slug_immutability ON content.titles;
CREATE TRIGGER trg_enforce_title_slug_immutability
BEFORE UPDATE OF slug ON content.titles
FOR EACH ROW
EXECUTE FUNCTION content.enforce_title_slug_immutability();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) & ACCESS CONTROL ON `content` TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE content.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE content.titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content.episode_media ENABLE ROW LEVEL SECURITY;

-- 5.1 Public Read Policies for Catalog Discovery
DROP POLICY IF EXISTS "Public read channels" ON content.channels;
CREATE POLICY "Public read channels" ON content.channels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read published titles" ON content.titles;
CREATE POLICY "Public read published titles" ON content.titles FOR SELECT USING (status = 'Published');

DROP POLICY IF EXISTS "Public read episodes of published titles" ON content.episodes;
CREATE POLICY "Public read episodes of published titles" ON content.episodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content.titles t
      WHERE t.id = episodes.title_id
        AND t.status = 'Published'
    )
  );

-- 5.2 Permissions & Grants on content tables:
-- Public can read channels and published titles
GRANT SELECT ON TABLE content.channels TO anon, authenticated;
GRANT SELECT ON TABLE content.titles TO anon, authenticated;

-- Public can read non-sensitive episode metadata; direct video_url is restricted
REVOKE SELECT ON TABLE content.episodes FROM anon, authenticated;
GRANT SELECT (
  id,
  title_id,
  episode_number,
  title,
  thumbnail_url,
  duration_seconds,
  is_free,
  created_at
) ON TABLE content.episodes TO anon, authenticated;

-- episode_media locked down strictly to service_role and postgres
GRANT ALL ON TABLE content.episode_media TO postgres, service_role;
REVOKE ALL ON TABLE content.episode_media FROM anon, authenticated;

-- Service role has full permissions on all content tables
GRANT ALL ON TABLE content.channels TO service_role;
GRANT ALL ON TABLE content.titles TO service_role;
GRANT ALL ON TABLE content.episodes TO service_role;

-- ----------------------------------------------------------------------------
-- 6. NATIVE FOREIGN KEY CONSTRAINTS ON USER TABLES (public schema)
-- ----------------------------------------------------------------------------

-- 6.1 public.favorites: add title_id, backfill, prune orphans, apply FK ON DELETE CASCADE
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS title_id UUID;

-- Backfill title_id from content.titles using matching title_slug
UPDATE public.favorites f
SET title_id = t.id
FROM content.titles t
WHERE f.title_slug = t.slug
  AND f.title_id IS NULL;

-- Prune pre-existing orphaned rows resulting from legacy split-database era
-- Safe guard: Only prune orphans and enforce NOT NULL if content.titles has been populated.
-- If content.titles is currently empty (initial schema creation prior to data loader cutover),
-- we preserve all existing user engagement records so they can be backfilled during catalog migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM content.titles LIMIT 1) THEN
    DELETE FROM public.favorites WHERE title_id IS NULL;
    ALTER TABLE public.favorites ALTER COLUMN title_id SET NOT NULL;
  END IF;
END $$;

-- Drop legacy slug unique constraint and add new (user_id, title_id) constraint
ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_user_id_title_slug_key;
ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS uq_favorites_user_id_title_id;
ALTER TABLE public.favorites ADD CONSTRAINT uq_favorites_user_id_title_id UNIQUE (user_id, title_id);

-- Re-establish unique constraint on (user_id, title_slug) for seamless dual-mode application compatibility
ALTER TABLE public.favorites ADD CONSTRAINT favorites_user_id_title_slug_key UNIQUE (user_id, title_slug);

-- Apply native foreign key constraint with cascading delete
ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS fk_favorites_title_id;
ALTER TABLE public.favorites
  ADD CONSTRAINT fk_favorites_title_id
  FOREIGN KEY (title_id)
  REFERENCES content.titles(id)
  ON DELETE CASCADE;

-- Create index on foreign key to eliminate sequential table scans during cascading deletes
CREATE INDEX IF NOT EXISTS idx_favorites_title_id ON public.favorites(title_id);


-- 6.2 public.watch_history: add title_id, backfill, prune orphans, apply FK ON DELETE CASCADE
ALTER TABLE public.watch_history ADD COLUMN IF NOT EXISTS title_id UUID;

-- Backfill title_id from content.titles using matching title_slug
UPDATE public.watch_history w
SET title_id = t.id
FROM content.titles t
WHERE w.title_slug = t.slug
  AND w.title_id IS NULL;

-- Prune pre-existing orphaned rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM content.titles LIMIT 1) THEN
    DELETE FROM public.watch_history WHERE title_id IS NULL;
    ALTER TABLE public.watch_history ALTER COLUMN title_id SET NOT NULL;
  END IF;
END $$;

-- Drop legacy slug unique constraint and add new (user_id, title_id) constraint
ALTER TABLE public.watch_history DROP CONSTRAINT IF EXISTS watch_history_user_id_title_slug_key;
ALTER TABLE public.watch_history DROP CONSTRAINT IF EXISTS uq_watch_history_user_id_title_id;
ALTER TABLE public.watch_history ADD CONSTRAINT uq_watch_history_user_id_title_id UNIQUE (user_id, title_id);

-- Re-establish unique constraint on (user_id, title_slug) for seamless dual-mode application compatibility
ALTER TABLE public.watch_history ADD CONSTRAINT watch_history_user_id_title_slug_key UNIQUE (user_id, title_slug);

-- Apply native foreign key constraint with cascading delete
ALTER TABLE public.watch_history DROP CONSTRAINT IF EXISTS fk_watch_history_title_id;
ALTER TABLE public.watch_history
  ADD CONSTRAINT fk_watch_history_title_id
  FOREIGN KEY (title_id)
  REFERENCES content.titles(id)
  ON DELETE CASCADE;

-- Create index on foreign key
CREATE INDEX IF NOT EXISTS idx_watch_history_title_id ON public.watch_history(title_id);


-- 6.3 public.custom_list_items: add title_id, backfill, prune orphans, apply FK ON DELETE CASCADE
ALTER TABLE public.custom_list_items ADD COLUMN IF NOT EXISTS title_id UUID;

-- Backfill title_id from content.titles using matching title_slug
UPDATE public.custom_list_items c
SET title_id = t.id
FROM content.titles t
WHERE c.title_slug = t.slug
  AND c.title_id IS NULL;

-- Prune pre-existing orphaned rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM content.titles LIMIT 1) THEN
    DELETE FROM public.custom_list_items WHERE title_id IS NULL;
    ALTER TABLE public.custom_list_items ALTER COLUMN title_id SET NOT NULL;
  END IF;
END $$;

-- Drop legacy slug unique constraint and add new (list_id, title_id) constraint
ALTER TABLE public.custom_list_items DROP CONSTRAINT IF EXISTS custom_list_items_list_id_title_slug_key;
ALTER TABLE public.custom_list_items DROP CONSTRAINT IF EXISTS uq_custom_list_items_list_id_title_id;
ALTER TABLE public.custom_list_items ADD CONSTRAINT uq_custom_list_items_list_id_title_id UNIQUE (list_id, title_id);

-- Re-establish unique constraint on (list_id, title_slug) for seamless dual-mode application compatibility
ALTER TABLE public.custom_list_items ADD CONSTRAINT custom_list_items_list_id_title_slug_key UNIQUE (list_id, title_slug);

-- Apply native foreign key constraint with cascading delete
ALTER TABLE public.custom_list_items DROP CONSTRAINT IF EXISTS fk_custom_list_items_title_id;
ALTER TABLE public.custom_list_items
  ADD CONSTRAINT fk_custom_list_items_title_id
  FOREIGN KEY (title_id)
  REFERENCES content.titles(id)
  ON DELETE CASCADE;

-- Create index on foreign key
CREATE INDEX IF NOT EXISTS idx_custom_list_items_title_id ON public.custom_list_items(title_id);

-- ----------------------------------------------------------------------------
-- 6.4 DUAL-MODE SYNCHRONIZATION TRIGGERS
-- Auto-populates title_id from title_slug (and vice-versa) to prevent NOT NULL
-- failures while existing app code submits title_slug.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_engagement_title_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If title_id is missing but title_slug is provided, resolve title_id from content.titles
  IF NEW.title_id IS NULL AND NEW.title_slug IS NOT NULL THEN
    SELECT id INTO NEW.title_id
    FROM content.titles
    WHERE slug = NEW.title_slug;
  END IF;

  -- If title_slug is missing but title_id is provided, resolve title_slug from content.titles
  IF (NEW.title_slug IS NULL OR NEW.title_slug = '') AND NEW.title_id IS NOT NULL THEN
    SELECT slug INTO NEW.title_slug
    FROM content.titles
    WHERE id = NEW.title_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, content, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_favorites_title_id ON public.favorites;
CREATE TRIGGER trg_sync_favorites_title_id
BEFORE INSERT OR UPDATE ON public.favorites
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_engagement_title_id();

DROP TRIGGER IF EXISTS trg_sync_watch_history_title_id ON public.watch_history;
CREATE TRIGGER trg_sync_watch_history_title_id
BEFORE INSERT OR UPDATE ON public.watch_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_engagement_title_id();

DROP TRIGGER IF EXISTS trg_sync_custom_list_items_title_id ON public.custom_list_items;
CREATE TRIGGER trg_sync_custom_list_items_title_id
BEFORE INSERT OR UPDATE ON public.custom_list_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_engagement_title_id();

-- Keep user engagement cached slugs in sync when a drama slug is renamed in content.titles
CREATE OR REPLACE FUNCTION content.sync_title_slug_to_user_tables()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    UPDATE public.favorites SET title_slug = NEW.slug WHERE title_id = NEW.id;
    UPDATE public.watch_history SET title_slug = NEW.slug WHERE title_id = NEW.id;
    UPDATE public.custom_list_items SET title_slug = NEW.slug WHERE title_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_title_slug_to_user_tables ON content.titles;
CREATE TRIGGER trg_sync_title_slug_to_user_tables
AFTER UPDATE OF slug ON content.titles
FOR EACH ROW
EXECUTE FUNCTION content.sync_title_slug_to_user_tables();

-- Ensure permissions on user tables for authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.watch_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_list_items TO authenticated;

-- Reaffirm quarantine of user tables from anon role (defense in depth)
REVOKE ALL ON TABLE public.profiles, public.favorites, public.watch_history, public.custom_lists, public.custom_list_items FROM anon;
