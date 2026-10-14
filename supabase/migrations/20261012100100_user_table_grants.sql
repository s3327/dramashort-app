-- Ported from the dramashort-user chain (20260930163000_grant_permissions.sql) by ADR-0005.
-- The single project is built from this chain (ADR-0005); this file runs after the catalog chain.
-- The two schema-wide grants of the original are omitted: they would re-grant client writes on catalog tables (see 20261011110000).
-- ============================================================================
-- GRANT PERMISSIONS FOR USER DATABASE
-- ============================================================================

-- Grant full table permissions to postgres and service_role
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT ALL ON TABLE public.favorites TO postgres, service_role;
GRANT ALL ON TABLE public.watch_history TO postgres, service_role;
GRANT ALL ON TABLE public.custom_lists TO postgres, service_role;
GRANT ALL ON TABLE public.custom_list_items TO postgres, service_role;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
