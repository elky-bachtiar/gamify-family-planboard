/*
  # Simplify RLS policies for avatars-public bucket

  Since this is a public bucket for profile avatars,
  allow any authenticated user to manage files.
*/

-- Drop the old policies
DROP POLICY IF EXISTS "Users can upload own avatar v2" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar v2" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar v2" ON storage.objects;

-- Simple policy: Any authenticated user can upload to avatars-public
CREATE POLICY "Allow authenticated uploads to avatars-public"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars-public');

-- Simple policy: Any authenticated user can update in avatars-public
CREATE POLICY "Allow authenticated updates to avatars-public"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars-public');

-- Simple policy: Any authenticated user can delete from avatars-public
CREATE POLICY "Allow authenticated deletes from avatars-public"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars-public');
