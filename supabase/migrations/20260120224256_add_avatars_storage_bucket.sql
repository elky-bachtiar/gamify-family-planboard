/*
  # Create Avatar Storage Bucket

  1. Storage
    - Create 'avatars-public' bucket for profile pictures
    - Configure bucket to be public (no authentication needed to view)
    - Set up RLS policies for upload/update/delete operations

  2. Security
    - Users can upload their own avatar
    - Users can view any family member's avatar
    - Users can update their own avatar
    - Users can delete their own avatar

  3. Storage Structure
    - For authenticated users: avatars/{user_id}/{filename}
    - For PIN users: avatars/{member_id}/{filename}
*/

-- Create the avatars storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars-public',
  'avatars-public',
  true, -- Public bucket so getPublicUrl() works
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view family member avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Policy: Users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars-public' 
  AND auth.uid()::text = (storage.foldername(storage.objects.name))[1]
);

-- Policy: Users can view avatars from their family
CREATE POLICY "Users can view family member avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars-public'
  AND (
    -- User can view their own avatar
    auth.uid()::text = (storage.foldername(storage.objects.name))[1]
    OR
    -- User can view avatars of members in their family
    EXISTS (
      SELECT 1 FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
      AND fm2.user_id::text = (storage.foldername(storage.objects.name))[1]
    )
    OR
    -- User can view avatars of PIN users in their family
    EXISTS (
      SELECT 1 FROM family_members fm1
      JOIN family_members fm2 ON fm1.family_id = fm2.family_id
      WHERE fm1.user_id = auth.uid()
      AND fm2.id::text = (storage.foldername(storage.objects.name))[1]
      AND fm2.is_pin_user = true
    )
  )
);

-- Policy: Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars-public'
  AND auth.uid()::text = (storage.foldername(storage.objects.name))[1]
)
WITH CHECK (
  bucket_id = 'avatars-public'
  AND auth.uid()::text = (storage.foldername(storage.objects.name))[1]
);

-- Policy: Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars-public'
  AND auth.uid()::text = (storage.foldername(storage.objects.name))[1]
);