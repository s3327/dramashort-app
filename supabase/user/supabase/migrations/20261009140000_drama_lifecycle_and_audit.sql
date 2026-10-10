-- Migration 20261009140000_drama_lifecycle_and_audit.sql
-- Task 16.4: Drama Lifecycle Actions, Published Tracking & Audit Log

-- Trigger function to automatically set has_been_published when status becomes 'Published'
CREATE OR REPLACE FUNCTION public.sync_title_has_been_published()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'Published' THEN
    NEW.has_been_published := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The User DB keeps its catalog in the `content` schema (ADR-0003); `public.titles`
-- only exists in mirrored single-database environments, so steps 1-3 are guarded.
DO $$
BEGIN
  IF to_regclass('public.titles') IS NOT NULL THEN
    -- 1. Add has_been_published to titles
    ALTER TABLE public.titles
      ADD COLUMN IF NOT EXISTS has_been_published BOOLEAN NOT NULL DEFAULT FALSE;

    -- 2. Backfill existing published titles
    UPDATE public.titles
    SET has_been_published = TRUE
    WHERE status = 'Published';

    -- 3. Attach the trigger
    DROP TRIGGER IF EXISTS trg_sync_title_has_been_published ON public.titles;
    CREATE TRIGGER trg_sync_title_has_been_published
    BEFORE INSERT OR UPDATE OF status ON public.titles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_title_has_been_published();
  END IF;
END $$;

-- 4. Create admin_audit_log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON public.admin_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);

-- Grants
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated, service_role;
