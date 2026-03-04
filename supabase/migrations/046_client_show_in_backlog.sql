-- Add show_in_backlog column to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS show_in_backlog boolean NOT NULL DEFAULT false;

-- Set show_in_backlog = true for any client that already has backlog tasks
UPDATE clients SET show_in_backlog = true
WHERE id IN (
  SELECT DISTINCT client FROM tasks WHERE day = 'backlog' AND client IS NOT NULL
);
