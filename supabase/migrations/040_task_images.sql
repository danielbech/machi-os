-- Add images array column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
