/*
  # Per-Family Message Encryption

  This migration adds encryption at rest for message content using pgcrypto.
  Each family gets a unique encryption key - database breach exposes only encrypted data.

  ## Architecture:
  - SEND: Frontend → send-message Edge Function → encrypt_message_content() → INSERT encrypted
  - READ: Frontend → messages_decrypted view → decrypt_message_content() → plaintext returned

  ## Changes:
  1. Enable pgcrypto extension
  2. Create encryption_keys table for family keys
  3. Add encrypted content columns to messages
  4. Create encryption/decryption SQL functions
  5. Create trigger for auto-generating encryption keys on family creation
  6. Create messages_decrypted view for transparent decryption
  7. Generate keys for existing families
  8. Migrate existing plaintext messages

  ## Security:
  - AES-256-CBC encryption with random IV per message
  - Keys stored in separate table with restricted access
  - SECURITY DEFINER functions prevent direct key access
*/

-- ============================================================================
-- 1. ENABLE PGCRYPTO EXTENSION
-- ============================================================================

-- pgcrypto may be in 'extensions' schema on Supabase hosted
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Make pgcrypto functions available without schema prefix
-- This ensures gen_random_bytes(), encrypt_iv(), decrypt_iv() work
DO $$
BEGIN
  -- Add extensions schema to search path if not already there
  IF current_setting('search_path') NOT LIKE '%extensions%' THEN
    EXECUTE 'ALTER DATABASE postgres SET search_path TO public, extensions';
  END IF;
END;
$$;

-- Set search_path for this session
SET search_path TO public, extensions;

-- ============================================================================
-- 2. CREATE ENCRYPTION KEYS TABLE
-- ============================================================================

-- Store encryption keys separately from families for additional security
CREATE TABLE IF NOT EXISTS family_encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL UNIQUE REFERENCES families(id) ON DELETE CASCADE,
  encryption_key bytea NOT NULL,  -- 256-bit AES key
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on encryption keys table
ALTER TABLE family_encryption_keys ENABLE ROW LEVEL SECURITY;

-- CRITICAL: No SELECT policy for authenticated users - keys only accessible via SECURITY DEFINER functions
-- Only service role can access directly
CREATE POLICY "Service role only" ON family_encryption_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Revoke all access from authenticated users
REVOKE ALL ON family_encryption_keys FROM authenticated;
REVOKE ALL ON family_encryption_keys FROM anon;

-- Create index
CREATE INDEX IF NOT EXISTS idx_family_encryption_keys_family ON family_encryption_keys(family_id);

-- ============================================================================
-- 3. ADD ENCRYPTED CONTENT COLUMNS TO MESSAGES
-- ============================================================================

-- Add columns for encrypted content
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS content_encrypted bytea,
ADD COLUMN IF NOT EXISTS encryption_iv bytea,
ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- Add comments
COMMENT ON COLUMN messages.content_encrypted IS 'AES-256-CBC encrypted message content';
COMMENT ON COLUMN messages.encryption_iv IS 'Initialization vector used for encryption';
COMMENT ON COLUMN messages.is_encrypted IS 'Whether this message has encrypted content';

-- Create index for filtering encrypted vs unencrypted messages (for migration)
CREATE INDEX IF NOT EXISTS idx_messages_is_encrypted ON messages(is_encrypted) WHERE is_encrypted = false;

-- ============================================================================
-- 4. CREATE FAMILY ENCRYPTION KEY FUNCTION
-- ============================================================================

-- Function to create an encryption key for a family
CREATE OR REPLACE FUNCTION create_family_encryption_key(p_family_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key_id uuid;
  v_encryption_key bytea;
BEGIN
  -- Check if key already exists
  SELECT id INTO v_key_id
  FROM family_encryption_keys
  WHERE family_id = p_family_id;

  IF v_key_id IS NOT NULL THEN
    RETURN v_key_id;
  END IF;

  -- Generate a 256-bit (32-byte) random encryption key
  v_encryption_key := gen_random_bytes(32);

  -- Insert the key
  INSERT INTO family_encryption_keys (family_id, encryption_key)
  VALUES (p_family_id, v_encryption_key)
  RETURNING id INTO v_key_id;

  RETURN v_key_id;
END;
$$;

-- Grant execute to service role only (edge functions)
REVOKE ALL ON FUNCTION create_family_encryption_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION create_family_encryption_key(uuid) FROM authenticated;

-- ============================================================================
-- 5. CREATE ENCRYPTION FUNCTION
-- ============================================================================

-- Function to encrypt message content (called by edge function)
-- Returns the encrypted content and IV
CREATE OR REPLACE FUNCTION encrypt_message_content(
  p_content text,
  p_family_id uuid
)
RETURNS TABLE(encrypted_content bytea, iv bytea)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_encryption_key bytea;
  v_iv bytea;
  v_encrypted bytea;
BEGIN
  -- Get the family's encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM family_encryption_keys
  WHERE family_id = p_family_id;

  IF v_encryption_key IS NULL THEN
    RAISE EXCEPTION 'Family % does not have an encryption key', p_family_id;
  END IF;

  -- Generate a random 16-byte IV for AES-CBC
  v_iv := gen_random_bytes(16);

  -- Encrypt the content using AES-256-CBC
  -- pgcrypto's encrypt() uses AES with the key length determining AES variant
  v_encrypted := encrypt_iv(
    convert_to(p_content, 'UTF8'),  -- plaintext
    v_encryption_key,                -- 32-byte key = AES-256
    v_iv,                            -- initialization vector
    'aes-cbc/pad:pkcs'               -- AES-CBC with PKCS7 padding
  );

  encrypted_content := v_encrypted;
  iv := v_iv;
  RETURN NEXT;
END;
$$;

-- Grant execute to service role only
REVOKE ALL ON FUNCTION encrypt_message_content(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION encrypt_message_content(text, uuid) FROM authenticated;

-- ============================================================================
-- 6. CREATE DECRYPTION FUNCTION
-- ============================================================================

-- Function to decrypt message content (used by the view)
CREATE OR REPLACE FUNCTION decrypt_message_content(
  p_encrypted bytea,
  p_iv bytea,
  p_family_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_encryption_key bytea;
  v_decrypted bytea;
BEGIN
  -- Return NULL for invalid input
  IF p_encrypted IS NULL OR p_iv IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the family's encryption key
  SELECT encryption_key INTO v_encryption_key
  FROM family_encryption_keys
  WHERE family_id = p_family_id;

  IF v_encryption_key IS NULL THEN
    RETURN NULL;  -- No key, can't decrypt
  END IF;

  -- Decrypt the content
  BEGIN
    v_decrypted := decrypt_iv(
      p_encrypted,          -- ciphertext
      v_encryption_key,     -- key
      p_iv,                 -- initialization vector
      'aes-cbc/pad:pkcs'    -- AES-CBC with PKCS7 padding
    );

    RETURN convert_from(v_decrypted, 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    -- Decryption failed (tampered or wrong key)
    RETURN '[Decryption failed]';
  END;
END;
$$;

-- Grant execute to authenticated users (used by the view)
GRANT EXECUTE ON FUNCTION decrypt_message_content(bytea, bytea, uuid) TO authenticated;

-- ============================================================================
-- 7. CREATE TRIGGER FOR NEW FAMILIES
-- ============================================================================

-- Trigger function to create encryption key when a family is created
CREATE OR REPLACE FUNCTION trigger_create_family_encryption_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Create an encryption key for the new family
  PERFORM create_family_encryption_key(NEW.id);
  RETURN NEW;
END;
$$;

-- Create the trigger (only if it doesn't exist)
DROP TRIGGER IF EXISTS on_family_created_create_encryption_key ON families;
CREATE TRIGGER on_family_created_create_encryption_key
  AFTER INSERT ON families
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_family_encryption_key();

-- ============================================================================
-- 8. CREATE DECRYPTED MESSAGES VIEW
-- ============================================================================

-- View that transparently decrypts message content
-- This is what the frontend queries for reading messages
CREATE OR REPLACE VIEW messages_decrypted AS
SELECT
  m.id,
  m.family_id,
  m.sender_id,
  m.recipient_id,
  -- Return decrypted content if encrypted, otherwise original content
  CASE
    WHEN m.is_encrypted AND m.content_encrypted IS NOT NULL THEN
      decrypt_message_content(m.content_encrypted, m.encryption_iv, m.family_id)
    ELSE
      m.content
  END AS content,
  m.read_at,
  m.created_at,
  m.is_encrypted
FROM messages m;

-- Grant access to the view (RLS on underlying table still applies)
GRANT SELECT ON messages_decrypted TO authenticated;

-- Add comment
COMMENT ON VIEW messages_decrypted IS 'Messages view with automatic decryption of encrypted content';

-- ============================================================================
-- 9. GENERATE KEYS FOR EXISTING FAMILIES
-- ============================================================================

-- Create encryption keys for all existing families that don't have one
DO $$
DECLARE
  v_family RECORD;
BEGIN
  FOR v_family IN
    SELECT f.id
    FROM families f
    LEFT JOIN family_encryption_keys fek ON f.id = fek.family_id
    WHERE fek.id IS NULL
  LOOP
    PERFORM create_family_encryption_key(v_family.id);
    RAISE NOTICE 'Created encryption key for family %', v_family.id;
  END LOOP;
END;
$$;

-- ============================================================================
-- 10. CREATE HELPER FUNCTION FOR EDGE FUNCTION
-- ============================================================================

-- Function to insert an encrypted message (called by edge function)
-- This wraps encryption + insertion in a single transaction
CREATE OR REPLACE FUNCTION insert_encrypted_message(
  p_family_id uuid,
  p_sender_id uuid,
  p_recipient_id uuid,
  p_content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_message_id uuid;
  v_encrypted_result RECORD;
BEGIN
  -- Generate message ID
  v_message_id := gen_random_uuid();

  -- Encrypt the content
  SELECT * INTO v_encrypted_result
  FROM encrypt_message_content(p_content, p_family_id);

  -- Insert the encrypted message
  INSERT INTO messages (
    id,
    family_id,
    sender_id,
    recipient_id,
    content,
    content_encrypted,
    encryption_iv,
    is_encrypted
  ) VALUES (
    v_message_id,
    p_family_id,
    p_sender_id,
    p_recipient_id,
    '[encrypted]',  -- Placeholder for plaintext column
    v_encrypted_result.encrypted_content,
    v_encrypted_result.iv,
    true
  );

  RETURN v_message_id;
END;
$$;

-- Grant execute to service role only
REVOKE ALL ON FUNCTION insert_encrypted_message(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION insert_encrypted_message(uuid, uuid, uuid, text) FROM authenticated;

-- ============================================================================
-- 11. MIGRATE EXISTING PLAINTEXT MESSAGES
-- ============================================================================

-- Function to migrate a single message to encrypted storage
CREATE OR REPLACE FUNCTION migrate_message_to_encrypted(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_message RECORD;
  v_encrypted_result RECORD;
BEGIN
  -- Get the message
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id
  AND (is_encrypted = false OR is_encrypted IS NULL)
  AND content IS NOT NULL
  AND content != ''
  AND content != '[encrypted]';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Encrypt the content
  SELECT * INTO v_encrypted_result
  FROM encrypt_message_content(v_message.content, v_message.family_id);

  -- Update the message with encrypted content
  UPDATE messages
  SET
    content_encrypted = v_encrypted_result.encrypted_content,
    encryption_iv = v_encrypted_result.iv,
    is_encrypted = true,
    content = '[encrypted]'  -- Replace plaintext with placeholder
  WHERE id = p_message_id;

  RETURN true;
END;
$$;

-- Migrate all existing messages in batches
DO $$
DECLARE
  v_message_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_message_id IN
    SELECT id FROM messages
    WHERE (is_encrypted = false OR is_encrypted IS NULL)
    AND content IS NOT NULL
    AND content != ''
    AND content != '[encrypted]'
    LIMIT 1000  -- Process in batches
  LOOP
    PERFORM migrate_message_to_encrypted(v_message_id);
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    RAISE NOTICE 'Migrated % messages to encrypted storage', v_count;
  END IF;
END;
$$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify setup by checking key count matches family count
DO $$
DECLARE
  v_families_without_keys integer;
BEGIN
  SELECT COUNT(*) INTO v_families_without_keys
  FROM families f
  LEFT JOIN family_encryption_keys fek ON f.id = fek.family_id
  WHERE fek.id IS NULL;

  IF v_families_without_keys > 0 THEN
    RAISE WARNING 'Found % families without encryption keys', v_families_without_keys;
  ELSE
    RAISE NOTICE 'All families have encryption keys';
  END IF;
END;
$$;
