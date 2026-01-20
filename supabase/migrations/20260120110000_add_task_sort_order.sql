-- Add sort_order column to tasks table for drag-and-drop reordering
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for efficient sorting within a day
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(family_id, due_date, sort_order);

-- Set initial sort_order based on existing due_datetime order
WITH ranked_tasks AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY family_id, due_date ORDER BY due_datetime, created_at) * 1000 as new_sort_order
  FROM tasks
  WHERE sort_order = 0 OR sort_order IS NULL
)
UPDATE tasks
SET sort_order = ranked_tasks.new_sort_order
FROM ranked_tasks
WHERE tasks.id = ranked_tasks.id;
