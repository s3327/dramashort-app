-- ============================================================================
-- Migration: 20261009130000_scheduled_publishing.sql
-- Description: Adds publish_at timestamp and partial index for scheduled drama publishing (Task 16.3)
-- Target: Content Database (and mirrored in User DB for single-database topology)
-- ============================================================================

-- 1. Add publish_at column to titles
ALTER TABLE titles
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Partial index for fast lookup of pending scheduled dramas
CREATE INDEX IF NOT EXISTS idx_titles_scheduled_publish
  ON titles (status, publish_at)
  WHERE status = 'Scheduled';

-- 3. Ensure permissions for anon and authenticated clients to read publish_at
GRANT SELECT (publish_at) ON titles TO anon, authenticated;
GRANT ALL ON titles TO service_role;
