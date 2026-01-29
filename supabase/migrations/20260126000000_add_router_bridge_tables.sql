-- Router Bridge Tables for Taskaroo Bridge Agent
-- Enables Chrome extension to control local router parental controls

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing tables if they exist (CASCADE handles triggers)
DROP TABLE IF EXISTS bridge_commands CASCADE;
DROP TABLE IF EXISTS device_mappings CASCADE;
DROP TABLE IF EXISTS router_bridges CASCADE;

-- Bridge installations table
CREATE TABLE router_bridges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  router_ip inet,
  router_model text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'offline', 'error')),
  last_seen_at timestamptz,
  extension_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Device to family member mappings
CREATE TABLE device_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_id uuid NOT NULL REFERENCES router_bridges(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  device_mac macaddr NOT NULL,
  device_name text,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bridge_id, device_mac)
);

-- Command queue for bridge agents
CREATE TABLE bridge_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_id uuid NOT NULL REFERENCES router_bridges(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  command_type text NOT NULL CHECK (command_type IN ('block', 'unblock', 'schedule')),
  target_member_id uuid REFERENCES family_members(id) ON DELETE SET NULL,
  target_device_mac macaddr,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  triggered_by text NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'reward', 'consequence', 'schedule')),
  created_by uuid REFERENCES family_members(id) ON DELETE SET NULL,
  executed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_router_bridges_family_id ON router_bridges(family_id);
CREATE INDEX idx_router_bridges_status ON router_bridges(status);
CREATE INDEX idx_device_mappings_bridge_id ON device_mappings(bridge_id);
CREATE INDEX idx_device_mappings_member_id ON device_mappings(member_id);
CREATE INDEX idx_bridge_commands_bridge_id ON bridge_commands(bridge_id);
CREATE INDEX idx_bridge_commands_status ON bridge_commands(status);
CREATE INDEX idx_bridge_commands_pending ON bridge_commands(bridge_id, status) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE router_bridges ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_commands ENABLE ROW LEVEL SECURITY;

-- RLS Policies for router_bridges
CREATE POLICY "Admins can view family bridges" ON router_bridges FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = router_bridges.family_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

CREATE POLICY "Admins can create bridges" ON router_bridges FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = router_bridges.family_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

CREATE POLICY "Admins can update bridges" ON router_bridges FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = router_bridges.family_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

CREATE POLICY "Admins can delete bridges" ON router_bridges FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = router_bridges.family_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

-- RLS Policies for device_mappings
CREATE POLICY "View mappings via bridge access" ON device_mappings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM router_bridges rb JOIN family_members fm ON fm.family_id = rb.family_id WHERE rb.id = device_mappings.bridge_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

CREATE POLICY "Create mappings via bridge access" ON device_mappings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM router_bridges rb JOIN family_members fm ON fm.family_id = rb.family_id WHERE rb.id = device_mappings.bridge_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

CREATE POLICY "Update mappings via bridge access" ON device_mappings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM router_bridges rb JOIN family_members fm ON fm.family_id = rb.family_id WHERE rb.id = device_mappings.bridge_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

CREATE POLICY "Delete mappings via bridge access" ON device_mappings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM router_bridges rb JOIN family_members fm ON fm.family_id = rb.family_id WHERE rb.id = device_mappings.bridge_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

-- RLS Policies for bridge_commands
CREATE POLICY "View commands via bridge access" ON bridge_commands FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = bridge_commands.family_id AND fm.user_id = auth.uid() AND fm.is_admin = true));

CREATE POLICY "Update command status" ON bridge_commands FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM family_members fm WHERE fm.family_id = bridge_commands.family_id AND fm.user_id = auth.uid()))
  WITH CHECK (status IS NOT NULL);

-- Triggers
CREATE TRIGGER set_router_bridges_updated_at BEFORE UPDATE ON router_bridges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_device_mappings_updated_at BEFORE UPDATE ON device_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for bridge_commands
ALTER PUBLICATION supabase_realtime ADD TABLE bridge_commands;

-- Cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_bridge_commands()
RETURNS void AS $$
BEGIN
  DELETE FROM bridge_commands WHERE created_at < now() - interval '7 days' AND status IN ('completed', 'failed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE router_bridges IS 'Chrome extension installations connected to families for router control';
COMMENT ON TABLE device_mappings IS 'Maps network devices to family members for targeted internet controls';
COMMENT ON TABLE bridge_commands IS 'Command queue for block/unblock operations to be executed by Chrome extension';
