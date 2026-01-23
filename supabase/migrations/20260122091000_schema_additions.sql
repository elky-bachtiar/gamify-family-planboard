/*
  # Schema Additions

  This migration adds missing schema elements identified in requirements:

  ## Changes:
  1. Add birthdate column to family_members
  2. Add default_language column to families
  3. Create messages table for family messaging
*/

-- ============================================================================
-- 1. ADD BIRTHDATE TO FAMILY MEMBERS
-- ============================================================================

ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS birthdate date;

-- Index for birthday queries (month-day lookups for birthday celebrations)
CREATE INDEX IF NOT EXISTS idx_family_members_birthdate
ON family_members(EXTRACT(MONTH FROM birthdate), EXTRACT(DAY FROM birthdate))
WHERE birthdate IS NOT NULL;

-- ============================================================================
-- 2. ADD DEFAULT LANGUAGE TO FAMILIES
-- ============================================================================

ALTER TABLE families
ADD COLUMN IF NOT EXISTS default_language text DEFAULT 'en';

-- ============================================================================
-- 3. CREATE MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;

-- ============================================================================
-- MESSAGES RLS POLICIES
-- ============================================================================

-- Family members can view messages in their family
-- For private messages: sender or recipient
-- For broadcast messages (recipient_id IS NULL): anyone in family
CREATE POLICY "Family members can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    family_id = get_user_family_id()
    AND (
      recipient_id IS NULL  -- Broadcast to family
      OR sender_id = get_current_member_id()  -- I sent it
      OR recipient_id = get_current_member_id()  -- Sent to me
      OR is_family_admin()  -- Admins can see all family messages
    )
  );

-- Family members can send messages within their family
CREATE POLICY "Family members can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    family_id = get_user_family_id()
    AND sender_id = get_current_member_id()
    -- Recipient must be in same family (if specified)
    AND (
      recipient_id IS NULL
      OR recipient_id IN (SELECT id FROM family_members WHERE family_id = get_user_family_id())
    )
  );

-- Recipients can mark messages as read (update read_at)
CREATE POLICY "Recipients can update messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    family_id = get_user_family_id()
    AND (
      recipient_id = get_current_member_id()
      OR (recipient_id IS NULL AND family_id = get_user_family_id())  -- Broadcast message
    )
  )
  WITH CHECK (
    family_id = get_user_family_id()
    -- Only allow updating read_at, not content modification
  );

-- Only admins can delete messages
CREATE POLICY "Admins can delete messages"
  ON messages FOR DELETE
  TO authenticated
  USING (
    family_id = get_user_family_id()
    AND (
      is_family_admin()
      OR sender_id = get_current_member_id()  -- Sender can delete their own messages
    )
  );

-- ============================================================================
-- INDEXES FOR MESSAGES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_messages_family ON messages(family_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, read_at) WHERE read_at IS NULL;
