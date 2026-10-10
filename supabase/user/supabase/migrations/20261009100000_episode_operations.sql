-- ============================================================================
-- USER DATABASE (MIRRORED TOPOLOGY): EPISODE MANAGEMENT & OPERATIONS (Task 16.1)
-- ============================================================================
-- The User DB keeps its catalog in the `content` schema (ADR-0003), so the
-- legacy `public.titles` / `public.episodes` / `public.episode_media` tables only
-- exist in mirrored single-database environments. Every statement is guarded so
-- the chain applies cleanly on a fresh User DB.

DO $$
BEGIN
  -- 1. Add free_episodes_count to titles table (default 5 for freemium model)
  IF to_regclass('public.titles') IS NOT NULL THEN
    ALTER TABLE public.titles
      ADD COLUMN IF NOT EXISTS free_episodes_count INT NOT NULL DEFAULT 5 CHECK (free_episodes_count >= 0);
  END IF;

  IF to_regclass('public.episodes') IS NOT NULL THEN
    -- 2. Add release_at to episodes table for scheduled episode release
    ALTER TABLE public.episodes
      ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ DEFAULT NULL;

    -- 3. Grant column-level SELECT on release_at to anon and authenticated
    GRANT SELECT (release_at) ON TABLE public.episodes TO anon, authenticated;

    -- 4. Ensure full permissions to service_role and postgres for admin operations
    GRANT ALL ON TABLE public.episodes TO postgres, service_role;
  END IF;

  IF to_regclass('public.episode_media') IS NOT NULL THEN
    GRANT ALL ON TABLE public.episode_media TO postgres, service_role;
  END IF;
END $$;
