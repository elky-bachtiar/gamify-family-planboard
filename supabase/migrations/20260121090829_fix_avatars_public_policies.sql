/*
  # Fix RLS policies for avatars-public bucket

  The previous policies only checked auth.uid() but the code uses
  familyMember.user_id || familyMember.id as the folder name.

  Updated policies check against the family_members table to verify
  the user owns the folder they're uploading to.
*/

-- Drop the old policies
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

-- Policy: Users can upload avatar to folder matching their user_id or member_id
CREATE POLICY "Users can upload own avatar v2"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars-public'
  AND (
    -- Folder matches auth.uid() directly
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- Folder matches a family_member.id where user_id = auth.uid()
    EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid()
      AND id::text = (storage.foldername(name))[1]
    )
  )
);

-- Policy: Users can update avatar in folder matching their user_id or member_id
CREATE POLICY "Users can update own avatar v2"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars-public'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid()
      AND id::text = (storage.foldername(name))[1]
    )
  )
);

-- Policy: Users can delete avatar in folder matching their user_id or member_id
CREATE POLICY "Users can delete own avatar v2"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars-public'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    EXISTS (
      SELECT 1 FROM family_members
      WHERE user_id = auth.uid()
      AND id::text = (storage.foldername(name))[1]
    )
  )
);
