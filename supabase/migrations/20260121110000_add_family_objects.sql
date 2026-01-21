-- Create family_objects table for managing objects/tags with pictures
CREATE TABLE IF NOT EXISTS family_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, name)
);

-- Enable RLS
ALTER TABLE family_objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view objects in their family
CREATE POLICY "Users can view family objects"
  ON family_objects FOR SELECT
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

-- Policy: Admins can insert objects
CREATE POLICY "Admins can create family objects"
  ON family_objects FOR INSERT
  WITH CHECK (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Policy: Admins can update objects
CREATE POLICY "Admins can update family objects"
  ON family_objects FOR UPDATE
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

-- Policy: Admins can delete objects
CREATE POLICY "Admins can delete family objects"
  ON family_objects FOR DELETE
  USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Create storage bucket for family object images
INSERT INTO storage.buckets (id, name, public)
VALUES ('family-objects', 'family-objects', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for family-objects bucket
CREATE POLICY "Public read access for family objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'family-objects');

CREATE POLICY "Admins can upload family object images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'family-objects'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update family object images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'family-objects'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete family object images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'family-objects'
    AND (storage.foldername(name))[1] IN (
      SELECT family_id::text FROM family_members WHERE user_id = auth.uid() AND is_admin = true
    )
  );
