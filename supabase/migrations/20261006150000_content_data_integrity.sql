-- ============================================================================
-- CONTENT DATABASE: DATA INTEGRITY & SYNCHRONIZATION RULES (Task 12.7)
-- ============================================================================

-- 1. ADD episodes_available TO TITLES
ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS episodes_available INT NOT NULL DEFAULT 0;

-- 2. TRIGGER: AUTOMATICALLY COMPUTE episodes_available ON EPISODES MUTATIONS
CREATE OR REPLACE FUNCTION public.sync_title_episodes_available()
RETURNS TRIGGER AS $$
DECLARE
  v_title_id UUID;
  v_count INT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_title_id := OLD.title_id;
  ELSE
    v_title_id := NEW.title_id;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.episodes
  WHERE title_id = v_title_id;

  UPDATE public.titles
  SET episodes_available = v_count
  WHERE id = v_title_id;

  -- Handle case where UPDATE changes title_id across titles
  IF TG_OP = 'UPDATE' AND OLD.title_id IS DISTINCT FROM NEW.title_id THEN
    SELECT COUNT(*) INTO v_count
    FROM public.episodes
    WHERE title_id = OLD.title_id;

    UPDATE public.titles
    SET episodes_available = v_count
    WHERE id = OLD.title_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_title_episodes_available ON public.episodes;
CREATE TRIGGER trg_sync_title_episodes_available
AFTER INSERT OR UPDATE OR DELETE ON public.episodes
FOR EACH ROW
EXECUTE FUNCTION public.sync_title_episodes_available();

-- Backfill existing episode counts for all existing titles
UPDATE public.titles t
SET episodes_available = COALESCE((
  SELECT COUNT(*)
  FROM public.episodes e
  WHERE e.title_id = t.id
), 0);

-- 3. TRIGGER: KEEP channel_name AND channel_code ON TITLES SYNCHRONIZED WHEN A CHANNEL IS UPDATED
CREATE OR REPLACE FUNCTION public.sync_channel_to_titles()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name OR NEW.code IS DISTINCT FROM OLD.code THEN
    UPDATE public.titles
    SET 
      channel_name = NEW.name,
      channel_code = NEW.code
    WHERE channel_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_channel_to_titles ON public.channels;
CREATE TRIGGER trg_sync_channel_to_titles
AFTER UPDATE OF name, code ON public.channels
FOR EACH ROW
EXECUTE FUNCTION public.sync_channel_to_titles();

-- 4. TRIGGER: AUTO-POPULATE channel_name AND channel_code FROM channel_id ON INSERT/UPDATE OF channel_id
CREATE OR REPLACE FUNCTION public.sync_title_channel_from_fk()
RETURNS TRIGGER AS $$
DECLARE
  v_channel RECORD;
BEGIN
  IF NEW.channel_id IS NOT NULL THEN
    SELECT name, code INTO v_channel
    FROM public.channels
    WHERE id = NEW.channel_id;

    IF FOUND THEN
      NEW.channel_name := v_channel.name;
      NEW.channel_code := v_channel.code;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_title_channel_from_fk ON public.titles;
CREATE TRIGGER trg_sync_title_channel_from_fk
BEFORE INSERT OR UPDATE OF channel_id ON public.titles
FOR EACH ROW
WHEN (NEW.channel_id IS NOT NULL)
EXECUTE FUNCTION public.sync_title_channel_from_fk();

-- 5. TRIGGER: ENFORCE SLUG IMMUTABILITY ONCE A DRAMA HAS BEEN PUBLISHED
CREATE OR REPLACE FUNCTION public.enforce_title_slug_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- If drama status was Published, slug cannot be modified
  IF OLD.status = 'Published' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'Slug cannot be modified once a drama has been published';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_title_slug_immutability ON public.titles;
CREATE TRIGGER trg_enforce_title_slug_immutability
BEFORE UPDATE OF slug ON public.titles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_title_slug_immutability();

-- 6. PERMISSIONS & GRANTS
GRANT SELECT (episodes_available) ON TABLE public.titles TO anon, authenticated;
