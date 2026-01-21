/*
  # Add RLS policies for avatars-public bucket

  Policies:
  - Authenticated users can upload to their own folder
  - Authenticated users can update their own files
  - Authenticated users can delete their own files
  - Public read access is already enabled via bucket setting
*/

-- Policy: Authenticated users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars-public'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Authenticated users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars-public'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Authenticated users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars-public'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
