-- Migration 20261009180000_platform_settings.sql
-- Task 16.8: Platform Settings Persistence & Maintenance Mode

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default initial configurations if not present
INSERT INTO public.app_settings (key, value, description)
VALUES
  (
    'general',
    '{
      "siteName": "DramaShort",
      "siteTagline": "Vertical dramas for a 12-minute break",
      "defaultLanguage": "English",
      "timezone": "UTC",
      "maintenanceMode": false
    }'::jsonb,
    'General platform branding and maintenance configuration'
  ),
  (
    'site',
    '{
      "trendingPeriod": "Weekly",
      "relatedTitlesSource": "Genre / Tags / Channel",
      "historyRetentionDays": 60,
      "newReleaseMaxDisplay": 24,
      "showContinueWatching": true,
      "showTopTrending": true
    }'::jsonb,
    'Catalog presentation and homepage module settings'
  ),
  (
    'users',
    '{
      "defaultPlan": "Free",
      "requireEmailVerification": true,
      "allowGoogleLogin": true,
      "allowTelegramLogin": true,
      "signupEnabled": true,
      "deletionGracePeriodDays": 14,
      "defaultFreeEpisodes": 3
    }'::jsonb,
    'User account policy, auth provider toggles, and episode access rules'
  ),
  (
    'ads',
    '{
      "enabled": false,
      "network": "None",
      "showOnHome": false,
      "showOnWatch": false,
      "frequency": "Every 3 episodes"
    }'::jsonb,
    'Monetization and advertising break configurations'
  ),
  (
    'features',
    '{
      "autoplayNext": true,
      "hlsStreaming": true,
      "guestFavorites": true
    }'::jsonb,
    'Platform feature flags and experimental capabilities'
  )
ON CONFLICT (key) DO NOTHING;

-- Index for lookup and sort
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON public.app_settings(updated_at DESC);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.app_settings TO anon, authenticated, service_role;
GRANT ALL ON public.app_settings TO service_role;

-- Policies: public read, service_role write
DROP POLICY IF EXISTS "Public can read app_settings" ON public.app_settings;
CREATE POLICY "Public can read app_settings" ON public.app_settings
  FOR SELECT TO anon, authenticated, service_role
  USING (true);
