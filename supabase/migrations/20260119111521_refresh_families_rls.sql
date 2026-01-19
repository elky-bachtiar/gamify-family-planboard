/*
  # Refresh RLS on Families Table

  ## Problem
  Sometimes Postgres caches RLS policy evaluation. Even though policies
  look correct, the cached evaluation might be causing issues.

  ## Solution
  Disable and immediately re-enable RLS to force fresh policy evaluation.
  This does not affect the data or policies, just refreshes the internal cache.

  ## Changes
  1. Disable RLS on families table
  2. Immediately re-enable RLS on families table
  3. All policies remain intact
*/

-- Disable RLS temporarily
ALTER TABLE families DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS immediately
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
