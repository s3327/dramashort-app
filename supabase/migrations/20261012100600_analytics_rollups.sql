-- Ported from the dramashort-user chain (20261008180000_analytics_rollups.sql) by ADR-0005.
-- The single project is built from this chain (ADR-0005); this file runs after the catalog chain.
-- ==============================================================================
-- Migration: Analytics Rollups (Task 15.3, ADR-0003)
-- Description: Creates title_stats_daily and episode_stats_daily summary tables,
--              indexes, RLS policies, and aggregation rollup functions.
-- ==============================================================================

-- 1. Daily Title Performance & Trending Rollup Table
CREATE TABLE IF NOT EXISTS public.title_stats_daily (
  id bigserial PRIMARY KEY,
  title_slug text NOT NULL,
  stat_date date NOT NULL,
  starts integer NOT NULL DEFAULT 0,
  completes integer NOT NULL DEFAULT 0,
  unique_viewers integer NOT NULL DEFAULT 0,
  avg_completion numeric(5,4) NOT NULL DEFAULT 0,
  ep1_to_ep2_rate numeric(5,4) NOT NULL DEFAULT 0,
  trending_score numeric(12,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_title_stats_daily UNIQUE (title_slug, stat_date)
);

-- 2. Daily Episode Performance & Drop-off Rollup Table
CREATE TABLE IF NOT EXISTS public.episode_stats_daily (
  id bigserial PRIMARY KEY,
  title_slug text NOT NULL,
  episode_number integer NOT NULL,
  stat_date date NOT NULL,
  starts integer NOT NULL DEFAULT 0,
  completes integer NOT NULL DEFAULT 0,
  unique_viewers integer NOT NULL DEFAULT 0,
  avg_completion numeric(5,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_episode_stats_daily UNIQUE (title_slug, episode_number, stat_date)
);

-- 3. Performance & Aggregation Indexes
CREATE INDEX IF NOT EXISTS idx_title_stats_daily_slug_date 
  ON public.title_stats_daily(title_slug, stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_title_stats_daily_date_trending 
  ON public.title_stats_daily(stat_date DESC, trending_score DESC);

CREATE INDEX IF NOT EXISTS idx_episode_stats_daily_slug_ep_date 
  ON public.episode_stats_daily(title_slug, episode_number, stat_date DESC);

-- 4. Row Level Security (RLS)
ALTER TABLE public.title_stats_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episode_stats_daily ENABLE ROW LEVEL SECURITY;

-- Public can read aggregated statistics (powers trending page and public counters)
CREATE POLICY "Public read for title stats daily"
  ON public.title_stats_daily
  FOR SELECT
  USING (true);

CREATE POLICY "Public read for episode stats daily"
  ON public.episode_stats_daily
  FOR SELECT
  USING (true);

-- Service role has full mutation rights (used by cron aggregation job)
CREATE POLICY "Service role full access on title stats daily"
  ON public.title_stats_daily
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on episode stats daily"
  ON public.episode_stats_daily
  FOR ALL
  USING (auth.role() = 'service_role');

-- 5. Stored Function for In-Database Daily Rollups
CREATE OR REPLACE FUNCTION public.rollup_daily_playback_stats(target_date date DEFAULT CURRENT_DATE)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed_titles int := 0;
  v_processed_episodes int := 0;
BEGIN
  -- A. Aggregate Episode Level Statistics
  INSERT INTO public.episode_stats_daily (
    title_slug,
    episode_number,
    stat_date,
    starts,
    completes,
    unique_viewers,
    avg_completion,
    updated_at
  )
  SELECT
    title_slug,
    COALESCE(episode_number, 1) AS episode_number,
    target_date,
    COUNT(*) FILTER (WHERE event_type = 'episode_start') AS starts,
    COUNT(*) FILTER (WHERE event_type = 'episode_complete') AS completes,
    COUNT(DISTINCT anon_id) AS unique_viewers,
    CASE 
      WHEN COUNT(*) FILTER (WHERE event_type = 'episode_start') > 0 
      THEN ROUND(
        LEAST(1.0, (COUNT(*) FILTER (WHERE event_type = 'episode_complete')::numeric / 
        COUNT(*) FILTER (WHERE event_type = 'episode_start')::numeric)), 
        4
      )
      ELSE 0
    END AS avg_completion,
    now()
  FROM public.playback_events
  WHERE occurred_at >= target_date::timestamptz 
    AND occurred_at < (target_date + 1)::timestamptz
  GROUP BY title_slug, COALESCE(episode_number, 1)
  ON CONFLICT (title_slug, episode_number, stat_date)
  DO UPDATE SET
    starts = EXCLUDED.starts,
    completes = EXCLUDED.completes,
    unique_viewers = EXCLUDED.unique_viewers,
    avg_completion = EXCLUDED.avg_completion,
    updated_at = now();

  GET DIAGNOSTICS v_processed_episodes = ROW_COUNT;

  -- B. Aggregate Title Level Statistics
  WITH ep1_viewers AS (
    SELECT DISTINCT title_slug, anon_id
    FROM public.playback_events
    WHERE occurred_at >= target_date::timestamptz 
      AND occurred_at < (target_date + 1)::timestamptz
      AND event_type = 'episode_start'
      AND episode_number = 1
  ),
  ep2_viewers AS (
    SELECT DISTINCT title_slug, anon_id
    FROM public.playback_events
    WHERE occurred_at >= target_date::timestamptz 
      AND occurred_at < (target_date + 1)::timestamptz
      AND event_type = 'episode_start'
      AND episode_number = 2
  ),
  retention AS (
    SELECT 
      e1.title_slug,
      COUNT(DISTINCT e1.anon_id) AS ep1_count,
      COUNT(DISTINCT e2.anon_id) AS ep2_count,
      CASE 
        WHEN COUNT(DISTINCT e1.anon_id) > 0 
        THEN ROUND(COUNT(DISTINCT e2.anon_id)::numeric / COUNT(DISTINCT e1.anon_id)::numeric, 4)
        ELSE 0 
      END AS ep1_to_ep2_rate
    FROM ep1_viewers e1
    LEFT JOIN ep2_viewers e2 ON e1.title_slug = e2.title_slug AND e1.anon_id = e2.anon_id
    GROUP BY e1.title_slug
  )
  INSERT INTO public.title_stats_daily (
    title_slug,
    stat_date,
    starts,
    completes,
    unique_viewers,
    avg_completion,
    ep1_to_ep2_rate,
    trending_score,
    updated_at
  )
  SELECT
    p.title_slug,
    target_date,
    COUNT(*) FILTER (WHERE p.event_type = 'episode_start') AS starts,
    COUNT(*) FILTER (WHERE p.event_type = 'episode_complete') AS completes,
    COUNT(DISTINCT p.anon_id) AS unique_viewers,
    CASE 
      WHEN COUNT(*) FILTER (WHERE p.event_type = 'episode_start') > 0 
      THEN ROUND(
        LEAST(1.0, (COUNT(*) FILTER (WHERE p.event_type = 'episode_complete')::numeric / 
        COUNT(*) FILTER (WHERE p.event_type = 'episode_start')::numeric)), 
        4
      )
      ELSE 0
    END AS avg_completion,
    COALESCE(r.ep1_to_ep2_rate, 0) AS ep1_to_ep2_rate,
    -- Daily base score = starts * (1 + avg_completion)
    ROUND(
      COUNT(*) FILTER (WHERE p.event_type = 'episode_start')::numeric * 
      (1.0 + CASE 
        WHEN COUNT(*) FILTER (WHERE p.event_type = 'episode_start') > 0 
        THEN LEAST(1.0, (COUNT(*) FILTER (WHERE p.event_type = 'episode_complete')::numeric / 
             COUNT(*) FILTER (WHERE p.event_type = 'episode_start')::numeric))
        ELSE 0 
      END),
      4
    ) AS trending_score,
    now()
  FROM public.playback_events p
  LEFT JOIN retention r ON p.title_slug = r.title_slug
  WHERE p.occurred_at >= target_date::timestamptz 
    AND p.occurred_at < (target_date + 1)::timestamptz
  GROUP BY p.title_slug, r.ep1_to_ep2_rate
  ON CONFLICT (title_slug, stat_date)
  DO UPDATE SET
    starts = EXCLUDED.starts,
    completes = EXCLUDED.completes,
    unique_viewers = EXCLUDED.unique_viewers,
    avg_completion = EXCLUDED.avg_completion,
    ep1_to_ep2_rate = EXCLUDED.ep1_to_ep2_rate,
    trending_score = EXCLUDED.trending_score,
    updated_at = now();

  GET DIAGNOSTICS v_processed_titles = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'date', target_date,
    'processed_titles', v_processed_titles,
    'processed_episodes', v_processed_episodes
  );
END;
$$;
