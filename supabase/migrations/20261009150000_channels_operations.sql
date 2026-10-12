-- ============================================================================
-- CONTENT DATABASE: CHANNELS OPERATIONS & LIFECYCLE (Task 16.5)
-- ============================================================================

-- 1. Ensure updated_at column exists on channels table
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Performance indexes on slug and code
CREATE INDEX IF NOT EXISTS idx_channels_slug ON public.channels (slug);
CREATE INDEX IF NOT EXISTS idx_channels_code ON public.channels (code);

-- 3. Automatic updated_at trigger for channels
CREATE OR REPLACE FUNCTION public.set_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_channels_updated_at ON public.channels;
CREATE TRIGGER trg_set_channels_updated_at
BEFORE UPDATE ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.set_channels_updated_at();

-- 4. Table grants
GRANT ALL ON TABLE public.channels TO postgres, service_role;
GRANT SELECT ON TABLE public.channels TO anon, authenticated;
