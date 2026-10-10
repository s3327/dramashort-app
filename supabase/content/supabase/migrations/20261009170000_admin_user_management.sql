-- Migration 20261009170000_admin_user_management.sql
-- Task 16.7: Admin User Management, Ban Enforcement & Role Management
--
-- Content DB mirror. `public.profiles` lives in the User DB, so it only exists here
-- in single-database environments; every statement is guarded so the chain applies
-- cleanly on a fresh Content DB.

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
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
  END IF;
END $$;
