-- ============================================================================
-- Explicit service_role grants (ADR-0005; found by plan Task 11 Step 3)
-- ============================================================================
-- The hosted project gives service_role no data access through default
-- privileges: a new table gets only TRUNCATE, REFERENCES, TRIGGER and MAINTAIN,
-- a new sequence nothing. The local stack granted everything by default, so the
-- analytics rollup tables of 20261012100600, created without grants, worked
-- locally and were unreadable and unwritable for server code on the hosted project.

-- 1. What server code needs: lib/services/analytics.service.ts upserts and reads
--    the rollups through the service role. Sequence grants match the local state.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.episode_stats_daily, public.title_stats_daily
  TO service_role;
GRANT USAGE, SELECT, UPDATE
  ON SEQUENCE public.episode_stats_daily_id_seq, public.title_stats_daily_id_seq, public.playback_events_id_seq
  TO service_role;

-- 2. Local default privileges follow the hosted project, so a migration that
--    forgets its service_role grants fails locally (verify-catalog-rls.sql Test 6).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM service_role;
