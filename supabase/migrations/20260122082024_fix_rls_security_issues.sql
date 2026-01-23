-- Migration: Fix RLS Security Issues
-- Date: 2026-01-22
-- Fixes:
--   1. user_achievements INSERT - restrict to same family members only
--   2. avatars-public storage - users can only access their own folder
--   3. family_objects SELECT - use consistent get_user_family_id() helper
--   4. weekly_earnings SELECT - use consistent helper function

-- ============================================================================
-- Fix 1: user_achievements INSERT - restrict to same family members only
-- ============================================================================
-- ISSUE: Previous policy was WITH CHECK (true) allowing any authenticated user
-- to award achievements to ANY member in ANY family

DROP POLICY IF EXISTS "System can create user achievements" ON user_achievements;

CREATE POLICY "Users can create achievements for family members"
ON user_achievements FOR INSERT
TO authenticated
WITH CHECK (
  member_id IN (
    SELECT id FROM family_members
    WHERE family_id = get_user_family_id()
  )
);

-- ============================================================================
-- Fix 2: avatars-public storage - restrict to own folder
-- ============================================================================
-- ISSUE: Previous policies allowed any authenticated user to upload/update/delete
-- ANY avatar file in the bucket, regardless of ownership
-- Note: For local development, storage schema isn't available during migrations.

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated uploads to avatars-public" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated updates to avatars-public" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated deletes from avatars-public" ON storage.objects;

  -- Users can only upload to their own folder (user_id or member_id for PIN users)
  -- Path structure is: {userId}/avatar.{ext}
  CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars-public'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

  CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars-public'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

  CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars-public'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Storage schema not available during migration - skipping storage policies';
END $$;

-- ============================================================================
-- Fix 3: family_objects SELECT - use consistent helper function
-- ============================================================================
-- ISSUE: Previous policy used raw JWT claim parsing instead of the
-- get_user_family_id() helper, which was inconsistent and fragile

DROP POLICY IF EXISTS "Users can view family objects" ON family_objects;

CREATE POLICY "Users can view family objects"
ON family_objects FOR SELECT
TO authenticated
USING (family_id = get_user_family_id());

-- ============================================================================
-- Fix 4: weekly_earnings SELECT - use consistent helper function
-- ============================================================================
-- ISSUE: Previous policy used direct subquery instead of helper function,
-- which may not work correctly for PIN users

DROP POLICY IF EXISTS "Users can view own family weekly earnings" ON weekly_earnings;

CREATE POLICY "Users can view own family weekly earnings"
ON weekly_earnings FOR SELECT
TO authenticated
USING (family_id = get_user_family_id());
