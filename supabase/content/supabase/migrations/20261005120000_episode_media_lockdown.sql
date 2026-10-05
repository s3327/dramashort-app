-- ============================================================================
-- CONTENT DATABASE: EPISODE MEDIA LOCKDOWN & RLS RESTRICTION (Task 10.6)
-- ============================================================================

-- 1. Tighten RLS on episodes: public read allowed ONLY when parent title is Published
DROP POLICY IF EXISTS "Public read episodes" ON public.episodes;
DROP POLICY IF EXISTS "Public read episodes of published titles" ON public.episodes;

CREATE POLICY "Public read episodes of published titles" ON public.episodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.titles t
      WHERE t.id = episodes.title_id
        AND t.status = 'Published'
    )
  );

-- 2. Create episode_media table for server-gated playback assets
CREATE TABLE IF NOT EXISTS public.episode_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'custom',
  asset_ref TEXT,
  hls_url TEXT,
  mp4_url TEXT,
  duration_seconds INT DEFAULT 0,
  aspect_ratio TEXT DEFAULT '9:16',
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('processing', 'ready', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(episode_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_episode_media_episode_id ON public.episode_media(episode_id);

-- 3. Enable RLS on episode_media with NO public policy (accessible solely via service_role)
ALTER TABLE public.episode_media ENABLE ROW LEVEL SECURITY;

-- 4. Permissions & Grants:
-- Grant full table permissions on episode_media strictly to postgres and service_role
GRANT ALL ON TABLE public.episode_media TO postgres, service_role;

-- Revoke all table-level access from anon and authenticated on episode_media (defense in depth)
REVOKE ALL ON TABLE public.episode_media FROM anon, authenticated;

-- Restrict column-level grants on episodes:
-- Revoke full table SELECT and grant only non-sensitive metadata columns.
-- Direct access to raw video_url is denied to anon and authenticated.
REVOKE SELECT ON TABLE public.episodes FROM anon, authenticated;
GRANT SELECT (
  id,
  title_id,
  episode_number,
  title,
  thumbnail_url,
  duration_seconds,
  is_free,
  created_at
) ON TABLE public.episodes TO anon, authenticated;

-- 5. Backfill existing episode video_url data into episode_media
INSERT INTO public.episode_media (
  episode_id,
  provider,
  hls_url,
  mp4_url,
  duration_seconds,
  aspect_ratio,
  status
)
SELECT 
  id AS episode_id,
  'custom' AS provider,
  CASE WHEN video_url LIKE '%.m3u8%' THEN video_url ELSE NULL END AS hls_url,
  CASE WHEN video_url NOT LIKE '%.m3u8%' OR video_url IS NULL THEN video_url ELSE NULL END AS mp4_url,
  COALESCE(duration_seconds, 0) AS duration_seconds,
  '9:16' AS aspect_ratio,
  'ready' AS status
FROM public.episodes
WHERE video_url IS NOT NULL AND trim(video_url) != ''
ON CONFLICT (episode_id, provider) DO NOTHING;
