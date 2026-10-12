-- ADR-0005: copy of 20261010110000_lock_down_function_execute.sql. The functions it
-- locks that come from the dramashort-user chain (fulfill_payment_order,
-- rollup_daily_playback_stats) are created by the ported migrations above, after the
-- original runs in this chain, so its statements are applied again here.
-- ============================================================================
-- SECURITY: LOCK DOWN EXECUTE ON PRIVILEGED (SECURITY DEFINER) FUNCTIONS
-- ============================================================================
-- Before this migration the wallet and payment procedures were SECURITY DEFINER
-- functions in the API-exposed `public` schema with no caller check and no
-- EXECUTE restriction. PostgreSQL grants EXECUTE to PUBLIC on every new function,
-- and Supabase additionally grants it to anon/authenticated, so any client holding
-- the public anon key could call e.g.
--   rpc('credit_wallet_coins', { p_user_id, p_amount: 1000000, p_type: 'admin_grant' })
-- and mint coins, debit another user, or mark their own order as paid.
--
-- These functions are only ever called by the server with the service role key
-- (lib/server/wallet.ts, lib/services/analytics.service.ts).

-- ----------------------------------------------------------------------------
-- 1. Existing privileged functions: service_role only
-- ----------------------------------------------------------------------------
-- Matched by name so every overload is covered, and so the same migration is a
-- no-op for functions that do not exist in this database.
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'ensure_user_wallet',
        'credit_wallet_coins',
        'debit_wallet_coins',
        'unlock_episode_with_coins',
        'claim_daily_checkin',
        'fulfill_payment_order',
        'rollup_daily_playback_stats'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Default privileges: future functions are not client-callable by default
-- ----------------------------------------------------------------------------
-- Mirrors the table/sequence defaults from 20261004120000_harden_rls_and_grants.sql.
-- The PUBLIC default can only be removed globally (per-schema defaults can add to,
-- but not subtract from, the global ones). A migration that adds a function meant
-- for clients must now GRANT EXECUTE explicitly, as the search/taxonomy functions
-- already do.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
