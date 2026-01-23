-- Add comprehensive audit logs table for tracking all family activities
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient queries by family and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_family_id ON audit_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs for their family
CREATE POLICY "Admins can view family audit logs"
  ON audit_logs
  FOR SELECT
  USING (
    family_id IN (
      SELECT family_id FROM family_members
      WHERE (user_id = auth.uid() OR id = auth.uid())
      AND is_admin = true
    )
  );

-- Service role can insert audit logs (from edge functions)
CREATE POLICY "Service role can insert audit logs"
  ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Add consent tracking to family_members table
ALTER TABLE family_members
ADD COLUMN IF NOT EXISTS consent_given_at timestamptz,
ADD COLUMN IF NOT EXISTS consent_version text,
ADD COLUMN IF NOT EXISTS privacy_settings jsonb DEFAULT '{"data_collection": true, "analytics": true}'::jsonb;

-- Add data export tracking to families table
ALTER TABLE families
ADD COLUMN IF NOT EXISTS last_data_export_at timestamptz,
ADD COLUMN IF NOT EXISTS last_data_export_by uuid REFERENCES family_members(id);

COMMENT ON TABLE audit_logs IS 'Comprehensive audit log for tracking all family activities';
COMMENT ON COLUMN audit_logs.action IS 'Action performed: create, update, delete, login, approve, reject, etc.';
COMMENT ON COLUMN audit_logs.entity_type IS 'Type of entity: task, member, points, achievement, message, etc.';
COMMENT ON COLUMN audit_logs.entity_id IS 'ID of the affected entity';
COMMENT ON COLUMN audit_logs.details IS 'Additional context about the action in JSON format';
