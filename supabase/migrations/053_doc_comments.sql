-- Comments on docs — supports inline (text selection) and page-level comments with threading

CREATE TABLE IF NOT EXISTS doc_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES doc_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  selection text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE doc_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_comments_select" ON doc_comments
  FOR SELECT USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "doc_comments_insert" ON doc_comments
  FOR INSERT WITH CHECK (
    project_id IN (SELECT get_user_project_ids(auth.uid()))
    AND user_id = auth.uid()
  );

CREATE POLICY "doc_comments_update" ON doc_comments
  FOR UPDATE USING (
    user_id = auth.uid()
    OR project_id IN (SELECT get_user_admin_project_ids(auth.uid()))
  );

CREATE POLICY "doc_comments_delete" ON doc_comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR project_id IN (SELECT get_user_admin_project_ids(auth.uid()))
  );

CREATE INDEX doc_comments_doc_id_idx ON doc_comments(doc_id);
CREATE INDEX doc_comments_parent_id_idx ON doc_comments(parent_id);
