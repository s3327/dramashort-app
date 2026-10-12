-- Ported from the dramashort-user chain (20261005160000_support_tickets.sql) by ADR-0005.
-- The single project is built from this chain (ADR-0005); this file runs after the catalog chain.
-- ============================================================================
-- TASK 11.4: SUPPORT TICKETS & REPORT ISSUE PIPELINE
-- ============================================================================
-- Creates the support_tickets table in the User Database (bpidsbcrvpkavvdvtpgh).
-- Stores user support requests, playback bug reports, and structured diagnostic
-- context.
--
-- Access Control:
-- - RLS enabled immediately.
-- - No direct client SELECT/INSERT privileges for anon or authenticated roles.
-- - Strictly managed by the server-side route handler via service_role.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('general', 'playback', 'billing', 'content', 'account')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Revoke all direct client privileges from anon and authenticated roles
REVOKE ALL ON TABLE public.support_tickets FROM anon, authenticated;

-- Grant all privileges exclusively to the service_role
GRANT ALL ON TABLE public.support_tickets TO service_role;

-- The catalog chain's copy of Task 16.10 (20261009200000) already created
-- support_tickets without this foreign key, so CREATE TABLE IF NOT EXISTS above was a no-op.
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- The same catalog-side copy created assigned_to and resolved_by without the foreign
-- keys the dramashort-user chain gave them (Task 16.10).
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_assigned_to_fkey;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_resolved_by_fkey;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;
