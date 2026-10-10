-- ============================================================================
-- TASK 16.11: BULK IMPORT PIPELINE (USER DB PARITY)
-- ============================================================================
-- Enhances titles and episodes with external_source and external_id for
-- idempotent synchronization from external providers (DramaBoss, CSV, etc.),
-- and creates public.import_jobs tracking table.
-- ============================================================================

-- The User DB keeps its catalog in the `content` schema (ADR-0003); `public.titles`
-- and `public.episodes` only exist in mirrored single-database environments, so
-- steps 1-2 are guarded.
DO $$
BEGIN
  -- 1. Add external provenance columns to titles
  IF to_regclass('public.titles') IS NOT NULL THEN
    ALTER TABLE public.titles
      ADD COLUMN IF NOT EXISTS external_source TEXT,
      ADD COLUMN IF NOT EXISTS external_id TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_titles_external_source_id
      ON public.titles(external_source, external_id)
      WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
  END IF;

  -- 2. Add external provenance columns to episodes
  IF to_regclass('public.episodes') IS NOT NULL THEN
    ALTER TABLE public.episodes
      ADD COLUMN IF NOT EXISTS external_source TEXT,
      ADD COLUMN IF NOT EXISTS external_id TEXT;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_external_source_id
      ON public.episodes(external_source, external_id)
      WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
  END IF;
END $$;

-- 3. Create import_jobs table
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  source_name TEXT NOT NULL,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'dry_run_ready', 'processing', 'completed', 'failed')),
  total_dramas INT NOT NULL DEFAULT 0,
  total_episodes INT NOT NULL DEFAULT 0,
  created_dramas INT NOT NULL DEFAULT 0,
  updated_dramas INT NOT NULL DEFAULT 0,
  created_episodes INT NOT NULL DEFAULT 0,
  updated_episodes INT NOT NULL DEFAULT 0,
  unchanged_records INT NOT NULL DEFAULT 0,
  failed_records INT NOT NULL DEFAULT 0,
  validation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Trigger for import_jobs updated_at
CREATE OR REPLACE FUNCTION public.set_import_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_import_jobs_updated_at ON public.import_jobs;
CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_import_jobs_updated_at();

-- Performance indexes for import_jobs
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON public.import_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_actor ON public.import_jobs(actor_id);

-- Enable RLS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Revoke direct client write
REVOKE ALL ON TABLE public.import_jobs FROM anon, authenticated;

-- Service role full access
GRANT ALL ON TABLE public.import_jobs TO service_role;
