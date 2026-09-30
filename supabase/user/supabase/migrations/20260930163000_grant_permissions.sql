-- ============================================================================
-- GRANT PERMISSIONS FOR USER DATABASE
-- ============================================================================

-- Grant full table permissions to postgres and service_role
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
GRANT ALL ON TABLE public.favorites TO postgres, service_role;
GRANT ALL ON TABLE public.watch_history TO postgres, service_role;
GRANT ALL ON TABLE public.custom_lists TO postgres, service_role;
GRANT ALL ON TABLE public.custom_list_items TO postgres, service_role;

-- Grant permissions to authenticated and anon roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant sequence permissions
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;
