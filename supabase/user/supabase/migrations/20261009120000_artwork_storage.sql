-- ============================================================================
-- USER DATABASE (MIRRORED TOPOLOGY): ARTWORK STORAGE BUCKET (Task 16.2)
-- ============================================================================

-- 1. Create or configure artwork bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artwork',
  'artwork',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Allow public read access to artwork assets
DROP POLICY IF EXISTS "Public read artwork objects" ON storage.objects;
CREATE POLICY "Public read artwork objects" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'artwork');

-- 3. Allow service_role and authenticated admins to manage artwork
DROP POLICY IF EXISTS "Admin insert artwork objects" ON storage.objects;
CREATE POLICY "Admin insert artwork objects" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'artwork'
    AND (
      auth.role() = 'service_role'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin update artwork objects" ON storage.objects;
CREATE POLICY "Admin update artwork objects" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'artwork'
    AND (
      auth.role() = 'service_role'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admin delete artwork objects" ON storage.objects;
CREATE POLICY "Admin delete artwork objects" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'artwork'
    AND (
      auth.role() = 'service_role'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );
