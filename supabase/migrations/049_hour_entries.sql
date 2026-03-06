-- Hour entries: individual time registrations within an invoice group
CREATE TABLE hour_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_group_id uuid NOT NULL REFERENCES invoice_groups(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES client_groups(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  duration integer NOT NULL DEFAULT 0,   -- stored in minutes
  date date NOT NULL DEFAULT CURRENT_DATE,
  logged_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE hour_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hour_entries_select" ON hour_entries
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids(auth.uid())));
CREATE POLICY "hour_entries_insert" ON hour_entries
  FOR INSERT WITH CHECK (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
CREATE POLICY "hour_entries_update" ON hour_entries
  FOR UPDATE USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
CREATE POLICY "hour_entries_delete" ON hour_entries
  FOR DELETE USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));

CREATE INDEX idx_hour_entries_group ON hour_entries(invoice_group_id);
CREATE INDEX idx_hour_entries_project_client ON hour_entries(project_id, client_id);
