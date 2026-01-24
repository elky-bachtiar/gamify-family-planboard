-- Migration: Secure Redemption via Edge Function
--
-- This migration removes the direct INSERT policy on reward_redemptions
-- to force all redemptions through the request-redemption edge function.
-- This provides server-side validation of available points and prevents:
-- 1. Direct API abuse (bypassing UI)
-- 2. Race conditions (parallel requests)
-- 3. Over-redemption (requesting more points than available)

-- Remove the INSERT policy that allowed direct client inserts
DROP POLICY IF EXISTS "Family members can create redemption requests" ON reward_redemptions;

-- Add comment explaining the change
COMMENT ON TABLE reward_redemptions IS
  'Redemption requests must be created via request-redemption edge function for server-side validation. Direct INSERT is blocked by RLS.';

-- Note: The existing SELECT policy remains so users can view their redemptions
-- Note: The existing UPDATE policy remains so admins can approve/reject redemptions
