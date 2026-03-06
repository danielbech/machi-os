-- Invoice groups: batches of hour entries for a client, each with their own rate
CREATE TABLE invoice_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  invoice_number text,
  hourly_rate integer NOT NULL,          -- whole currency units (e.g. 850 = 850 kr/hr)
  status text NOT NULL DEFAULT 'active', -- 'active' | 'closed'
  share_token text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_groups_select" ON invoice_groups
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids(auth.uid())));
CREATE POLICY "invoice_groups_insert" ON invoice_groups
  FOR INSERT WITH CHECK (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
CREATE POLICY "invoice_groups_update" ON invoice_groups
  FOR UPDATE USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));
CREATE POLICY "invoice_groups_delete" ON invoice_groups
  FOR DELETE USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));

CREATE INDEX idx_invoice_groups_project_client ON invoice_groups(project_id, client_id);
CREATE UNIQUE INDEX idx_invoice_groups_share_token ON invoice_groups(share_token);
