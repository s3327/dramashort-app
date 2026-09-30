-- ============================================================================
-- CONTENT DATABASE SCHEMA (Project 1: Reusable Headless Media CMS)
-- ============================================================================

-- 1. CHANNELS TABLE
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,               -- e.g. "velvet-frame"
  code VARCHAR(10) UNIQUE NOT NULL,        -- e.g. "vf", "ds" (2-5 chars acronym)
  description TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TITLES (DRAMAS) TABLE
CREATE TABLE IF NOT EXISTS titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,               -- e.g. "reborn-to-ruin-him-vf"
  title TEXT NOT NULL,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  channel_name TEXT NOT NULL,
  channel_code VARCHAR(10) NOT NULL,
  poster_url TEXT NOT NULL,
  synopsis TEXT NOT NULL,
  genre TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  total_episodes INT NOT NULL DEFAULT 1,
  rating NUMERIC(2, 1) DEFAULT 0.0,
  views_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Scheduled', 'Archived')),
  release_year INT DEFAULT EXTRACT(YEAR FROM now()),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. EPISODES TABLE
CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  episode_number INT NOT NULL,
  title TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INT DEFAULT 0,
  is_free BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(title_id, episode_number)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_titles_slug ON titles(slug);
CREATE INDEX IF NOT EXISTS idx_titles_channel_code ON titles(channel_code);
CREATE INDEX IF NOT EXISTS idx_titles_genre ON titles(genre);
CREATE INDEX IF NOT EXISTS idx_titles_status_views ON titles(status, views_count DESC);
CREATE INDEX IF NOT EXISTS idx_titles_status_created ON titles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_title_id ON episodes(title_id);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

-- Drop policies if re-running
DROP POLICY IF EXISTS "Public read channels" ON channels;
CREATE POLICY "Public read channels" ON channels FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read published titles" ON titles;
CREATE POLICY "Public read published titles" ON titles FOR SELECT USING (status = 'Published');

DROP POLICY IF EXISTS "Public read episodes" ON episodes;
CREATE POLICY "Public read episodes" ON episodes FOR SELECT USING (true);
