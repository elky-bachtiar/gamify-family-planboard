-- Add color_palette column to families table
-- This allows families to select a color palette for profile colors

ALTER TABLE families
ADD COLUMN IF NOT EXISTS color_palette text DEFAULT 'default';

-- Add comment for documentation
COMMENT ON COLUMN families.color_palette IS 'Selected color palette for the family (default, soft, vintage, retro, neon, summer, fall, winter, spring, happy, kids)';
