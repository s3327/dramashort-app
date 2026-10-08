-- Migration: 20261008170000_playback_events.sql
-- Description: In-database playback events table and security policies for hybrid analytics (Task 15.1, ADR-0003)

CREATE TABLE IF NOT EXISTS public.playback_events (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    anon_id UUID NOT NULL,
    session_id UUID NOT NULL,
    title_slug TEXT NOT NULL,
    episode_number INT NOT NULL,
    event_type TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'pwa', 'tma')),
    position_seconds NUMERIC(8, 2),
    duration_seconds NUMERIC(8, 2),
    utm JSONB DEFAULT '{}'::jsonb,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance & Aggregation Indexes for Task 15.3 Rollups
CREATE INDEX IF NOT EXISTS idx_playback_events_occurred_at 
    ON public.playback_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_playback_events_title_ep 
    ON public.playback_events(title_slug, episode_number, event_type);

CREATE INDEX IF NOT EXISTS idx_playback_events_user_id 
    ON public.playback_events(user_id) 
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_playback_events_anon_id 
    ON public.playback_events(anon_id);

CREATE INDEX IF NOT EXISTS idx_playback_events_type_occurred 
    ON public.playback_events(event_type, occurred_at DESC);

-- Strict Row-Level Security: Only server-side service-role can write and aggregate
ALTER TABLE public.playback_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.playback_events FROM anon;
REVOKE ALL ON public.playback_events FROM authenticated;

GRANT ALL ON public.playback_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.playback_events_id_seq TO service_role;
