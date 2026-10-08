-- ============================================================================
-- SEARCH AND TAXONOMY SCALABILITY (Task 13.5: User / Consolidated Database)
-- ADR-0003: High-performance pg_trgm GIN indexing, SQL taxonomy aggregation,
-- and deterministic search_dramas RPC across content and public schemas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- 2. PERFORMANCE INDEXES ON `content.titles`
-- ----------------------------------------------------------------------------

-- GIN trigram indexes on title and synopsis using gin_trgm_ops
CREATE INDEX IF NOT EXISTS idx_content_titles_title_trgm
  ON content.titles USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_content_titles_synopsis_trgm
  ON content.titles USING gin (synopsis gin_trgm_ops);

-- GIN index on tags text array column for accelerated containment (@>)
CREATE INDEX IF NOT EXISTS idx_content_titles_tags_gin
  ON content.titles USING gin (tags);

-- B-tree partial index on genre for published catalog titles
CREATE INDEX IF NOT EXISTS idx_content_titles_genre_published
  ON content.titles (genre) WHERE status = 'Published';

-- ----------------------------------------------------------------------------
-- 3. COMPATIBILITY INDEXES ON `public.titles` (for legacy/split environments)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'titles') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_public_titles_title_trgm ON public.titles USING gin (title gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_public_titles_synopsis_trgm ON public.titles USING gin (synopsis gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_public_titles_tags_gin ON public.titles USING gin (tags)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_public_titles_genre_published ON public.titles (genre) WHERE status = ''Published''';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. TAXONOMY AGGREGATION & SEARCH RPCS (content schema)
-- ----------------------------------------------------------------------------

-- 4.1 Distinct Genres Aggregation RPC
-- Executes SELECT DISTINCT genre directly inside PostgreSQL, eliminating client row downloads and 1,000-row caps
CREATE OR REPLACE FUNCTION content.get_distinct_genres()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
  SELECT DISTINCT trim(genre) AS genre
  FROM content.titles
  WHERE status = 'Published' AND genre IS NOT NULL AND trim(genre) <> ''
  ORDER BY genre;
$$;

-- 4.2 Popular Tags Aggregation RPC
-- Executes SELECT unnest(tags) AS tag, count(*) directly inside PostgreSQL with frequency ranking
CREATE OR REPLACE FUNCTION content.get_popular_tags(limit_count INT DEFAULT 50)
RETURNS TABLE (tag TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
  SELECT t.tag, count(*) AS count
  FROM (
    SELECT trim(unnest(tags)) AS tag
    FROM content.titles
    WHERE status = 'Published' AND tags IS NOT NULL
  ) t
  WHERE t.tag IS NOT NULL AND t.tag <> ''
  GROUP BY t.tag
  ORDER BY count DESC, t.tag ASC
  LIMIT GREATEST(1, LEAST(200, COALESCE(limit_count, 50)));
$$;

-- 4.3 Combined Taxonomy Counts RPC
-- Returns structured JSON containing counts for both genres and tags in a single roundtrip
CREATE OR REPLACE FUNCTION content.get_taxonomy_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
DECLARE
  v_genres jsonb;
  v_tags jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('genre', genre, 'count', c) ORDER BY c DESC, genre ASC)
  INTO v_genres
  FROM (
    SELECT trim(genre) AS genre, count(*) AS c
    FROM content.titles
    WHERE status = 'Published' AND genre IS NOT NULL AND trim(genre) <> ''
    GROUP BY trim(genre)
  ) g;

  SELECT jsonb_agg(jsonb_build_object('tag', tag, 'count', c) ORDER BY c DESC, tag ASC)
  INTO v_tags
  FROM (
    SELECT t.tag, count(*) AS c
    FROM (
      SELECT trim(unnest(tags)) AS tag
      FROM content.titles
      WHERE status = 'Published' AND tags IS NOT NULL
    ) t
    WHERE t.tag IS NOT NULL AND t.tag <> ''
    GROUP BY t.tag
  ) tags_grouped;

  RETURN jsonb_build_object(
    'genres', COALESCE(v_genres, '[]'::jsonb),
    'tags', COALESCE(v_tags, '[]'::jsonb)
  );
END;
$$;

-- Alias taxonomy_counts() for Task 16.6 parity
CREATE OR REPLACE FUNCTION content.taxonomy_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
  SELECT content.get_taxonomy_counts();
$$;

-- 4.4 High-Performance Trigram & Indexed Search RPC
-- Deterministic search_dramas with relevance scoring, multi-facet filtering, and windowed total count resolution
CREATE OR REPLACE FUNCTION content.search_dramas(
  query_text TEXT DEFAULT NULL,
  filter_genre TEXT DEFAULT NULL,
  filter_channel_id UUID DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL,
  sort_by TEXT DEFAULT NULL,
  page_offset INT DEFAULT 0,
  page_limit INT DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  channel_id UUID,
  channel_name TEXT,
  channel_code VARCHAR(10),
  poster_url TEXT,
  synopsis TEXT,
  genre TEXT,
  tags TEXT[],
  total_episodes INT,
  episodes_available INT,
  rating NUMERIC(2, 1),
  views_count INT,
  status TEXT,
  release_year INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
DECLARE
  v_clean_query TEXT := NULL;
  v_like_query TEXT := NULL;
  v_limit INT := LEAST(100, GREATEST(1, COALESCE(page_limit, 24)));
  v_offset INT := GREATEST(0, COALESCE(page_offset, 0));
BEGIN
  IF query_text IS NOT NULL THEN
    v_clean_query := trim(query_text);
    IF v_clean_query = '' THEN
      v_clean_query := NULL;
    ELSE
      v_like_query := '%' || regexp_replace(v_clean_query, '\s+', '%', 'g') || '%';
    END IF;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT 
      t.id,
      t.slug,
      t.title,
      t.channel_id,
      t.channel_name,
      t.channel_code,
      t.poster_url,
      t.synopsis,
      t.genre,
      t.tags,
      t.total_episodes,
      COALESCE(t.episodes_available, 0) AS episodes_available,
      t.rating,
      t.views_count,
      t.status,
      t.release_year,
      t.created_at,
      t.updated_at,
      CASE 
        WHEN v_clean_query IS NOT NULL THEN
          (COALESCE(similarity(t.title, v_clean_query), 0.0) * 3.0 + COALESCE(similarity(t.synopsis, v_clean_query), 0.0))
        ELSE 0.0
      END AS relevance_score
    FROM content.titles t
    WHERE t.status = 'Published'
      AND (
        v_clean_query IS NULL 
        OR t.title ILIKE v_like_query
        OR t.synopsis ILIKE v_like_query
        OR t.title % v_clean_query
        OR t.synopsis % v_clean_query
      )
      AND (
        filter_genre IS NULL 
        OR filter_genre = '' 
        OR filter_genre = 'All' 
        OR filter_genre = 'All Genres' 
        OR t.genre = filter_genre
      )
      AND (filter_channel_id IS NULL OR t.channel_id = filter_channel_id)
      AND (
        filter_tags IS NULL 
        OR array_length(filter_tags, 1) IS NULL 
        OR filter_tags = '{}' 
        OR t.tags @> filter_tags
      )
  ),
  counted AS (
    SELECT count(*)::BIGINT AS total_rows FROM filtered
  )
  SELECT 
    f.id,
    f.slug,
    f.title,
    f.channel_id,
    f.channel_name,
    f.channel_code,
    f.poster_url,
    f.synopsis,
    f.genre,
    f.tags,
    f.total_episodes,
    f.episodes_available,
    f.rating,
    f.views_count,
    f.status,
    f.release_year,
    f.created_at,
    f.updated_at,
    c.total_rows AS total_count
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY 
    CASE WHEN sort_by = 'newest' THEN f.created_at END DESC NULLS LAST,
    CASE WHEN sort_by = 'rating' THEN f.rating END DESC NULLS LAST,
    CASE WHEN sort_by = 'relevance' OR (v_clean_query IS NOT NULL AND (sort_by IS NULL OR sort_by = '' OR sort_by = 'relevance')) THEN f.relevance_score END DESC NULLS LAST,
    CASE WHEN sort_by = 'trending' THEN f.views_count END DESC NULLS LAST,
    f.views_count DESC NULLS LAST,
    f.id ASC
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. PUBLIC SCHEMA WRAPPERS (for dual-topology client compatibility)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distinct_genres()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
  SELECT content.get_distinct_genres();
$$;

CREATE OR REPLACE FUNCTION public.get_popular_tags(limit_count INT DEFAULT 50)
RETURNS TABLE (tag TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
  SELECT * FROM content.get_popular_tags(limit_count);
$$;

CREATE OR REPLACE FUNCTION public.get_taxonomy_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
  SELECT content.get_taxonomy_counts();
$$;

CREATE OR REPLACE FUNCTION public.taxonomy_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
  SELECT content.get_taxonomy_counts();
$$;

CREATE OR REPLACE FUNCTION public.search_dramas(
  query_text TEXT DEFAULT NULL,
  filter_genre TEXT DEFAULT NULL,
  filter_channel_id UUID DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL,
  sort_by TEXT DEFAULT NULL,
  page_offset INT DEFAULT 0,
  page_limit INT DEFAULT 24
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  channel_id UUID,
  channel_name TEXT,
  channel_code VARCHAR(10),
  poster_url TEXT,
  synopsis TEXT,
  genre TEXT,
  tags TEXT[],
  total_episodes INT,
  episodes_available INT,
  rating NUMERIC(2, 1),
  views_count INT,
  status TEXT,
  release_year INT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = content, public, pg_temp
AS $$
  SELECT * FROM content.search_dramas(
    query_text,
    filter_genre,
    filter_channel_id,
    filter_tags,
    sort_by,
    page_offset,
    page_limit
  );
$$;

-- ----------------------------------------------------------------------------
-- 6. SECURITY & ROLE PRIVILEGES
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION content.get_distinct_genres() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION content.get_popular_tags(INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION content.get_taxonomy_counts() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION content.taxonomy_counts() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION content.search_dramas(TEXT, TEXT, UUID, TEXT[], TEXT, INT, INT) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_distinct_genres() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_popular_tags(INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_taxonomy_counts() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.taxonomy_counts() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_dramas(TEXT, TEXT, UUID, TEXT[], TEXT, INT, INT) TO anon, authenticated, service_role;
