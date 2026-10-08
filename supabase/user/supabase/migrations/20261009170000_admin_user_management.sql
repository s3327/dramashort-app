-- Migration 20261009170000_admin_user_management.sql
-- Task 16.7: Admin User Management, Ban Enforcement & Role Management

-- 1. Update check constraint on profiles.role to allow 'user', 'editor', 'admin'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'editor', 'admin'));

-- 2. Add ban columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 3. Indexes for fast filtering and administrative queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);

-- 4. Ensure service_role privileges
GRANT ALL ON TABLE public.profiles TO service_role;
