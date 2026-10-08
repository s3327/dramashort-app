-- Migration: Add hero banner curation fields to titles table (Task 14.6)
-- Supports landscape 16:9 banner images, editorial taglines, and featured order.

ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS hero_tagline TEXT,
  ADD COLUMN IF NOT EXISTS featured_rank INT;

-- Partial index for fast retrieval of curated featured titles
CREATE INDEX IF NOT EXISTS idx_titles_featured_rank
  ON public.titles (featured_rank ASC)
  WHERE status = 'Published' AND featured_rank IS NOT NULL;

-- Grant column read permissions to public anon and authenticated roles
GRANT SELECT (banner_url, hero_tagline, featured_rank) ON TABLE public.titles TO anon, authenticated;
