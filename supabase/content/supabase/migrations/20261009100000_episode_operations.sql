-- ============================================================================
-- CONTENT DATABASE: EPISODE MANAGEMENT & OPERATIONS (Task 16.1)
-- ============================================================================

-- 1. Add free_episodes_count to titles table (default 5 for freemium model)
ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS free_episodes_count INT NOT NULL DEFAULT 5 CHECK (free_episodes_count >= 0);

-- 2. Add release_at to episodes table for scheduled episode release
ALTER TABLE public.episodes
  ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Grant column-level SELECT on release_at to anon and authenticated
GRANT SELECT (release_at) ON TABLE public.episodes TO anon, authenticated;

-- 4. Ensure full permissions to service_role and postgres for admin operations
GRANT ALL ON TABLE public.episodes TO postgres, service_role;
GRANT ALL ON TABLE public.episode_media TO postgres, service_role;
