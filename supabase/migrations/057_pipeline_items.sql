-- Pipeline items for the finance page (expected revenue from upcoming projects)
CREATE TABLE pipeline_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount      integer NOT NULL DEFAULT 0,
  expected_month text NOT NULL, -- "YYYY-MM"
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE pipeline_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_select" ON pipeline_items
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids(auth.uid())));
CREATE POLICY "pipeline_insert" ON pipeline_items
  FOR INSERT WITH CHECK (project_id IN (SELECT get_user_project_ids(auth.uid())));
CREATE POLICY "pipeline_update" ON pipeline_items
  FOR UPDATE USING (project_id IN (SELECT get_user_project_ids(auth.uid())));
CREATE POLICY "pipeline_delete" ON pipeline_items
  FOR DELETE USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE INDEX idx_pipeline_items_project ON pipeline_items(project_id);
