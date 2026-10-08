-- ============================================================================
-- GENRES & TAGS TAXONOMY MANAGEMENT (Task 16.6: User Database Mirror)
-- Tables for genres & tags metadata, titles foreign key reference,
-- auto-backfill from existing catalog, triggers, RLS, and grants.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GENRES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_genres_slug ON public.genres (slug);
CREATE INDEX IF NOT EXISTS idx_genres_sort_order ON public.genres (sort_order ASC, name ASC);
CREATE INDEX IF NOT EXISTS idx_genres_is_visible ON public.genres (is_visible);

-- ----------------------------------------------------------------------------
-- 2. TAGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tags_slug ON public.tags (slug);
CREATE INDEX IF NOT EXISTS idx_tags_name ON public.tags (name);

-- ----------------------------------------------------------------------------
-- 3. TITLES FOREIGN KEY REFERENCE & INDEX (IF TITLES TABLE EXISTS IN MIRROR)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'titles'
  ) THEN
    ALTER TABLE public.titles
      ADD COLUMN IF NOT EXISTS genre_id UUID REFERENCES public.genres(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_titles_genre_id ON public.titles (genre_id);

    -- Backfill genres
    INSERT INTO public.genres (name, slug, sort_order, is_visible)
    SELECT DISTINCT
      trim(t.genre) AS name,
      lower(regexp_replace(regexp_replace(trim(t.genre), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) AS slug,
      0 AS sort_order,
      true AS is_visible
    FROM public.titles t
    WHERE t.genre IS NOT NULL AND trim(t.genre) <> ''
    ON CONFLICT (name) DO NOTHING;

    UPDATE public.titles t
    SET genre_id = g.id
    FROM public.genres g
    WHERE lower(trim(t.genre)) = lower(trim(g.name))
      AND t.genre_id IS NULL;

    -- Backfill tags
    INSERT INTO public.tags (name, slug)
    SELECT DISTINCT
      trim(tag_elem) AS name,
      lower(regexp_replace(regexp_replace(trim(tag_elem), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) AS slug
    FROM (
      SELECT unnest(tags) AS tag_elem
      FROM public.titles
      WHERE tags IS NOT NULL
    ) sub
    WHERE tag_elem IS NOT NULL AND trim(tag_elem) <> ''
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_taxonomy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_genres_updated_at ON public.genres;
CREATE TRIGGER trg_set_genres_updated_at
  BEFORE UPDATE ON public.genres
  FOR EACH ROW
  EXECUTE FUNCTION public.set_taxonomy_updated_at();

DROP TRIGGER IF EXISTS trg_set_tags_updated_at ON public.tags;
CREATE TRIGGER trg_set_tags_updated_at
  BEFORE UPDATE ON public.tags
  FOR EACH ROW
  EXECUTE FUNCTION public.set_taxonomy_updated_at();

-- ----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) & GRANTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view genres" ON public.genres;
CREATE POLICY "Public can view genres" ON public.genres
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view tags" ON public.tags;
CREATE POLICY "Public can view tags" ON public.tags
  FOR SELECT USING (true);

GRANT SELECT ON public.genres TO anon, authenticated;
GRANT SELECT ON public.tags TO anon, authenticated;
GRANT ALL ON public.genres TO service_role;
GRANT ALL ON public.tags TO service_role;

-- ----------------------------------------------------------------------------
-- 6. TAXONOMY RPCS ENHANCEMENT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_distinct_genres()
RETURNS SETOF TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.genres WHERE is_visible = true) THEN
    RETURN QUERY
    SELECT name
    FROM public.genres
    WHERE is_visible = true
    ORDER BY sort_order ASC, name ASC;
  ELSE
    RETURN QUERY
    SELECT DISTINCT trim(genre) AS genre
    FROM public.titles
    WHERE status = 'Published' AND genre IS NOT NULL AND trim(genre) <> ''
    ORDER BY genre;
  END IF;
END;
$$;

