/*
  # Update All Families RLS Policies to Use Authenticated Role

  ## Problem
  Several RLS policies on the families table use `TO public` but rely on
  auth.uid() checks. For better security and consistency, these should
  target the `authenticated` role explicitly.

  ## Changes
  1. Drop and recreate SELECT policy to target `authenticated` role
  2. Drop and recreate UPDATE policy to target `authenticated` role

  ## Security Benefits
  - More explicit about requiring authentication
  - Follows Supabase best practices
  - Clearer intent in policy definitions
  - Prevents any potential edge cases with public access
*/

-- Drop and recreate SELECT policy
DROP POLICY IF EXISTS "Users can view their own family" ON families;

CREATE POLICY "Users can view their own family"
  ON families FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- Drop and recreate UPDATE policy
DROP POLICY IF EXISTS "Family admins can update family settings" ON families;

CREATE POLICY "Family admins can update family settings"
  ON families FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT family_id FROM family_members 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    id IN (
      SELECT family_id FROM family_members 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );
