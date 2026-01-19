/*
  # Fix Families Table INSERT RLS Policy

  ## Problem
  The existing INSERT policy on the families table targets the `public` role,
  but authenticated users (those who have registered/logged in) have the
  `authenticated` role. This causes INSERT operations to fail with:
  "new row violates row-level security policy for table 'families'"

  ## Changes
  1. Drop the existing INSERT policy that targets `public` role
  2. Create a new INSERT policy that targets `authenticated` role
  3. This allows registered users to create their own families

  ## Security
  - Only authenticated users can create families (more secure than public)
  - Users must be logged in to create a family
  - The policy uses WITH CHECK (true) to allow any authenticated user to create
*/

-- Drop the old policy that targets public role
DROP POLICY IF EXISTS "Anyone can create a family" ON families;

-- Create new policy targeting authenticated users
CREATE POLICY "Authenticated users can create a family"
  ON families FOR INSERT
  TO authenticated
  WITH CHECK (true);
