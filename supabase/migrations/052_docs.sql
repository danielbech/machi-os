-- Docs / Pages feature — workspace-scoped documents with nested hierarchy

CREATE TABLE IF NOT EXISTS docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES docs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled',
  content jsonb NOT NULL DEFAULT '{}',
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE docs ENABLE ROW LEVEL SECURITY;

-- All workspace members can read
CREATE POLICY "docs_select" ON docs
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

-- All workspace members can create
CREATE POLICY "docs_insert" ON docs
  FOR INSERT WITH CHECK (
    project_id IN (SELECT get_user_project_ids(auth.uid()))
    AND created_by = auth.uid()
  );

-- Creator or admins can update
CREATE POLICY "docs_update" ON docs
  FOR UPDATE USING (
    created_by = auth.uid()
    OR project_id IN (SELECT get_user_admin_project_ids(auth.uid()))
  );

-- Creator or admins can delete
CREATE POLICY "docs_delete" ON docs
  FOR DELETE USING (
    created_by = auth.uid()
    OR project_id IN (SELECT get_user_admin_project_ids(auth.uid()))
  );

CREATE INDEX docs_project_id_idx ON docs(project_id);
CREATE INDEX docs_parent_id_idx ON docs(parent_id);
CREATE INDEX docs_sort_order_idx ON docs(project_id, parent_id, sort_order);
