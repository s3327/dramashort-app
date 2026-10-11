-- ============================================================================
-- SECURITY: CONTENT DATABASE LEAST-PRIVILEGE GRANTS FOR CLIENT ROLES
-- ============================================================================
-- Supabase's default privileges grant ALL on every table created in `public` to
-- anon and authenticated. The user database had that removed in
-- 20261004120000_harden_rls_and_grants.sql; the content database never did, so
-- client roles still held INSERT / UPDATE / DELETE / TRUNCATE on titles,
-- episodes, channels, genres, tags and app_settings. Row security blocked every
-- write only because no write policy exists; a single permissive policy would
-- have opened those tables to anyone holding the public anon key.
--
-- Nothing in the application writes to this database with a client role: all
-- writes go through the service role (lib/supabase/content.ts admin client).
-- SELECT grants, including the column-level grants on episodes, are untouched.

-- ----------------------------------------------------------------------------
-- 1. Existing tables: remove every write privilege from client roles
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT format('%I.%I', schemaname, tablename) AS name
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE %s FROM anon, authenticated',
      t.name
    );
    -- MAINTAIN is a separate table privilege from PostgreSQL 17 onwards
    IF current_setting('server_version_num')::int >= 170000 THEN
      EXECUTE format('REVOKE MAINTAIN ON TABLE %s FROM anon, authenticated', t.name);
    END IF;
  END LOOP;
END $$;

-- The audit log is never read without a session
DO $$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.admin_audit_log FROM anon;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Sequences
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Default privileges
-- ----------------------------------------------------------------------------
-- Tables and sequences created by future migrations are no longer readable or
-- writable by anon/authenticated until that migration grants access explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
