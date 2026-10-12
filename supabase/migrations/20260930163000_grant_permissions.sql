-- ============================================================================
-- GRANT PERMISSIONS FOR CONTENT DATABASE
-- ============================================================================

-- Grant full table permissions to postgres and service_role
GRANT ALL ON TABLE public.channels TO postgres, service_role;
GRANT ALL ON TABLE public.titles TO postgres, service_role;
GRANT ALL ON TABLE public.episodes TO postgres, service_role;

-- Grant select permissions to anon and authenticated users
GRANT SELECT ON TABLE public.channels TO anon, authenticated;
GRANT SELECT ON TABLE public.titles TO anon, authenticated;
GRANT SELECT ON TABLE public.episodes TO anon, authenticated;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
