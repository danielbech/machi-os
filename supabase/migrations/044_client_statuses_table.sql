-- Custom project status definitions per workspace
CREATE TABLE IF NOT EXISTS client_statuses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'gray',
  sort_order integer NOT NULL DEFAULT 0,
  treat_as_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS
ALTER TABLE client_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_statuses_select" ON client_statuses
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids()));
CREATE POLICY "client_statuses_insert" ON client_statuses
  FOR INSERT WITH CHECK (project_id IN (SELECT get_user_admin_project_ids()));
CREATE POLICY "client_statuses_update" ON client_statuses
  FOR UPDATE USING (project_id IN (SELECT get_user_admin_project_ids()));
CREATE POLICY "client_statuses_delete" ON client_statuses
  FOR DELETE USING (project_id IN (SELECT get_user_admin_project_ids()));

-- Seed default statuses for every existing project
INSERT INTO client_statuses (project_id, name, color, sort_order, treat_as_active)
SELECT id, 'Active', 'green', 0, true FROM projects
UNION ALL
SELECT id, 'Upcoming', 'blue', 1, true FROM projects
UNION ALL
SELECT id, 'Expected', 'amber', 2, true FROM projects
UNION ALL
SELECT id, 'Idle', 'gray', 3, false FROM projects;

-- Add status_id FK to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status_id uuid REFERENCES client_statuses(id) ON DELETE SET NULL;

-- Migrate existing status text → status_id
UPDATE clients c
SET status_id = cs.id
FROM client_statuses cs
WHERE cs.project_id = c.project_id
  AND LOWER(cs.name) = LOWER(c.status);
