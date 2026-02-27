-- Client groups: reusable client/company entities that projects can belong to
CREATE TABLE IF NOT EXISTS client_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE client_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_groups_select"
  ON client_groups FOR SELECT
  USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "client_groups_insert"
  ON client_groups FOR INSERT
  WITH CHECK (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "client_groups_update"
  ON client_groups FOR UPDATE
  USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "client_groups_delete"
  ON client_groups FOR DELETE
  USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));

-- Add client_group_id to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_group_id UUID REFERENCES client_groups(id) ON DELETE SET NULL;
