-- Migration 20261009190000_audit_log_and_roles.sql
-- Task 16.9: Audit Log & Role Model Indexes, RLS, and Schema Polish (User DB Mirror)

-- 1. Ensure public.admin_audit_log exists with all required columns
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

-- 2. Performance indexes for audit log querying and filtering
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON public.admin_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON public.admin_audit_log (actor_email, actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log (action);

-- 3. Row Level Security on admin_audit_log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has full unrestricted access
DROP POLICY IF EXISTS "Service role full access on admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "Service role full access on admin_audit_log"
  ON public.admin_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins can view audit logs (read-only)
DROP POLICY IF EXISTS "Admins can select admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "Admins can select admin_audit_log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Block direct mutations from client roles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
