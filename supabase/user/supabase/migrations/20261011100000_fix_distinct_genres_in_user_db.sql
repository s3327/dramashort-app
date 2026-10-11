-- ============================================================================
-- FIX: public.get_distinct_genres() IN THE USER DATABASE
-- ============================================================================
-- 20261009160000_taxonomy_management.sql (mirrored from the content database)
-- replaced the wrapper created in 20261008120000 with a body that falls back to
-- `public.titles` when no visible genre rows exist. The user database keeps its
-- catalog in the `content` schema, so that table does not exist here and the
-- function raised `relation "public.titles" does not exist` for every caller.
--
-- The fallback now reads `public.titles` only where it exists (mirrored
-- single-database environments) and otherwise delegates to
-- content.get_distinct_genres(), which is what the original wrapper did.
-- CREATE OR REPLACE keeps the existing EXECUTE grants.

CREATE OR REPLACE FUNCTION public.get_distinct_genres()
RETURNS SETOF TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, content, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.genres WHERE is_visible = true) THEN
    RETURN QUERY
    SELECT name
    FROM public.genres
    WHERE is_visible = true
    ORDER BY sort_order ASC, name ASC;
  ELSIF to_regclass('public.titles') IS NOT NULL THEN
    RETURN QUERY EXECUTE $q$
      SELECT DISTINCT trim(genre) AS genre
      FROM public.titles
      WHERE status = 'Published' AND genre IS NOT NULL AND trim(genre) <> ''
      ORDER BY genre
    $q$;
  ELSE
    RETURN QUERY
    SELECT g FROM content.get_distinct_genres() AS g;
  END IF;
END;
$$;
