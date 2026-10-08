-- ============================================================================
-- Migration: 20261009130000_scheduled_publishing.sql
-- Description: Adds publish_at timestamp and partial index for scheduled drama publishing (Task 16.3)
-- Target: User Database (mirrored for single-database topology environments)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'titles') THEN
    ALTER TABLE public.titles
      ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ DEFAULT NULL;

    CREATE INDEX IF NOT EXISTS idx_titles_scheduled_publish
      ON public.titles (status, publish_at)
      WHERE status = 'Scheduled';

    GRANT SELECT (publish_at) ON public.titles TO anon, authenticated;
    GRANT ALL ON public.titles TO service_role;
  END IF;
END $$;
