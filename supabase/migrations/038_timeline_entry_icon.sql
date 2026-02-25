-- Add icon column to timeline_entries for sub-item icons
ALTER TABLE timeline_entries ADD COLUMN IF NOT EXISTS icon text;
