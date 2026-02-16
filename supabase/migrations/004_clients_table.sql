-- 004_clients_table.sql
-- Clients table: workspace-specific clients with name, slug (keyboard shortcut), color, and optional logo

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  logo_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Members can read clients in their workspaces
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids()));

-- Admins/owners can insert/update/delete clients
CREATE POLICY "clients_insert" ON clients
  FOR INSERT WITH CHECK (project_id IN (SELECT get_user_admin_project_ids()));

CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (project_id IN (SELECT get_user_admin_project_ids()));

CREATE POLICY "clients_delete" ON clients
  FOR DELETE USING (project_id IN (SELECT get_user_admin_project_ids()));

-- Seed existing clients into all projects
INSERT INTO clients (project_id, name, slug, color, sort_order)
SELECT p.id, c.name, c.slug, c.color, c.sort_order
FROM projects p
CROSS JOIN (
  VALUES
    ('BookSpot',  'b', 'blue',   0),
    ('Evooq',     'e', 'green',  1),
    ('Tandem',    't', 'purple', 2),
    ('Anthill',   'a', 'orange', 3),
    ('Mazed',     'm', 'pink',   4)
) AS c(name, slug, color, sort_order);

-- Migrate tasks.client from old slug strings to new client UUIDs
-- Old values: 'bookspot', 'evooq', 'tandem', 'anthill', 'mazed'
-- Map them to the new client UUIDs by matching slug
UPDATE tasks t
SET client = c.id::text
FROM clients c
JOIN areas a ON a.project_id = c.project_id
WHERE t.area_id = a.id
  AND t.client IS NOT NULL
  AND t.client != ''
  AND (
    (LOWER(t.client) = 'bookspot' AND c.slug = 'b') OR
    (LOWER(t.client) = 'evooq'    AND c.slug = 'e') OR
    (LOWER(t.client) = 'tandem'   AND c.slug = 't') OR
    (LOWER(t.client) = 'anthill'  AND c.slug = 'a') OR
    (LOWER(t.client) = 'mazed'    AND c.slug = 'm')
  );
