-- ============================================================================
-- Migration: Streak Features, Deduction Disputes, and Task Object Associations
-- ============================================================================

-- ============================================================================
-- Part 1: Streak-related columns on family_members
-- ============================================================================

-- Add streak freeze feature (purchasable protection)
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS streak_freezes integer DEFAULT 0;

-- Track when streak was lost (for recovery window)
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS streak_lost_at timestamptz;

-- Store the last streak value before it was lost (for recovery)
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS last_streak_value integer;

-- Flag if streak was already recovered (one chance per loss)
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS streak_recovered boolean DEFAULT false;

-- Track when grace period started (24-hour warning before streak loss)
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS streak_grace_started_at timestamptz;

-- ============================================================================
-- Part 2: Evidence URLs on points_history (for deductions with proof)
-- ============================================================================

ALTER TABLE points_history
ADD COLUMN IF NOT EXISTS evidence_urls text[];

-- ============================================================================
-- Part 3: Associated object IDs on tasks
-- ============================================================================

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS associated_object_ids uuid[];

-- ============================================================================
-- Part 4: Deduction Disputes table
-- ============================================================================

CREATE TABLE IF NOT EXISTS deduction_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  points_history_id UUID NOT NULL REFERENCES points_history(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  points_restored INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate disputes on the same deduction
  UNIQUE(points_history_id)
);

-- Enable RLS on deduction_disputes
ALTER TABLE deduction_disputes ENABLE ROW LEVEL SECURITY;

-- Policy: Family members can view disputes in their family
CREATE POLICY "Users can view family disputes"
  ON deduction_disputes FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
    OR
    family_id IN (
      SELECT family_id FROM family_members WHERE id = (
        SELECT (current_setting('request.jwt.claims', true)::json->>'family_member_id')::uuid
      )
    )
  );

-- Policy: Children can create disputes for their own deductions
CREATE POLICY "Children can create disputes for own deductions"
  ON deduction_disputes FOR INSERT
  WITH CHECK (
    -- Check that creator is in the family
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
    OR
    family_id IN (
      SELECT family_id FROM family_members WHERE id = (
        SELECT (current_setting('request.jwt.claims', true)::json->>'family_member_id')::uuid
      )
    )
  );

-- Policy: Admins can update disputes (to resolve them)
CREATE POLICY "Admins can resolve disputes"
  ON deduction_disputes FOR UPDATE
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Index for faster dispute lookups
CREATE INDEX IF NOT EXISTS idx_deduction_disputes_family_id ON deduction_disputes(family_id);
CREATE INDEX IF NOT EXISTS idx_deduction_disputes_status ON deduction_disputes(status);
CREATE INDEX IF NOT EXISTS idx_deduction_disputes_created_by ON deduction_disputes(created_by);
CREATE INDEX IF NOT EXISTS idx_deduction_disputes_points_history_id ON deduction_disputes(points_history_id);

-- ============================================================================
-- Part 5: Storage bucket for dispute evidence
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('dispute-evidence', 'dispute-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for dispute-evidence bucket
-- Public read access (images need to be viewable)
CREATE POLICY "Public read access for dispute evidence"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dispute-evidence');

-- Family members can upload evidence (folder structure: family_id/member_id/filename)
CREATE POLICY "Family members can upload dispute evidence"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND (
      -- Regular users check
      (storage.foldername(name))[1] IN (
        SELECT family_id::text FROM family_members WHERE user_id = auth.uid()
      )
      OR
      -- PIN users check
      (storage.foldername(name))[1] IN (
        SELECT family_id::text FROM family_members WHERE id = (
          SELECT (current_setting('request.jwt.claims', true)::json->>'family_member_id')::uuid
        )
      )
    )
  );

-- Admins can delete evidence files
CREATE POLICY "Admins can delete dispute evidence"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dispute-evidence'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- ============================================================================
-- Part 6: Add index for task object associations
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_associated_object_ids ON tasks USING GIN(associated_object_ids);

-- ============================================================================
-- Part 7: Trigger to update updated_at on deduction_disputes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_deduction_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_deduction_disputes_updated_at
  BEFORE UPDATE ON deduction_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_deduction_disputes_updated_at();
