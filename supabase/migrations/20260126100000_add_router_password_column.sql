-- Add encrypted router password column to router_bridges
-- Password is encrypted client-side before storage for security

ALTER TABLE router_bridges
ADD COLUMN IF NOT EXISTS router_password_encrypted text;

-- Add router_username column (defaults to 'admin' for Linksys)
ALTER TABLE router_bridges
ADD COLUMN IF NOT EXISTS router_username text DEFAULT 'admin';

-- Add connection test result tracking
ALTER TABLE router_bridges
ADD COLUMN IF NOT EXISTS last_test_at timestamptz;

ALTER TABLE router_bridges
ADD COLUMN IF NOT EXISTS last_test_success boolean;

ALTER TABLE router_bridges
ADD COLUMN IF NOT EXISTS last_test_error text;

-- Comment documentation
COMMENT ON COLUMN router_bridges.router_password_encrypted IS 'AES-256-GCM encrypted router admin password';
COMMENT ON COLUMN router_bridges.router_username IS 'Router admin username (default: admin)';
COMMENT ON COLUMN router_bridges.last_test_at IS 'When connection was last tested';
COMMENT ON COLUMN router_bridges.last_test_success IS 'Whether last connection test succeeded';
COMMENT ON COLUMN router_bridges.last_test_error IS 'Error message from last failed test';
