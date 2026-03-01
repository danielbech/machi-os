-- Add status column to clients (replaces active boolean)
-- Statuses: active, upcoming, expected, idle
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Migrate existing data
UPDATE clients SET status = CASE WHEN active = true THEN 'active' ELSE 'idle' END;
