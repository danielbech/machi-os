-- Feedback kanban board: columns, ticket sort order, and upvotes

-- 1. feedback_columns table
CREATE TABLE feedback_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_columns_project_id_idx ON feedback_columns(project_id);

ALTER TABLE feedback_columns ENABLE ROW LEVEL SECURITY;

-- Workspace members can read columns
CREATE POLICY "feedback_columns_select"
  ON feedback_columns FOR SELECT
  USING (project_id IN (SELECT public.get_user_project_ids(auth.uid())));

-- Admins/owners can manage columns
CREATE POLICY "feedback_columns_insert"
  ON feedback_columns FOR INSERT
  WITH CHECK (project_id IN (SELECT public.get_user_admin_project_ids(auth.uid())));

CREATE POLICY "feedback_columns_update"
  ON feedback_columns FOR UPDATE
  USING (project_id IN (SELECT public.get_user_admin_project_ids(auth.uid())));

CREATE POLICY "feedback_columns_delete"
  ON feedback_columns FOR DELETE
  USING (project_id IN (SELECT public.get_user_admin_project_ids(auth.uid())));

-- 2. Add column_id and sort_order to feedback_tickets
ALTER TABLE feedback_tickets ADD COLUMN IF NOT EXISTS column_id uuid REFERENCES feedback_columns(id) ON DELETE SET NULL;
ALTER TABLE feedback_tickets ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS feedback_tickets_column_id_idx ON feedback_tickets(column_id);

-- 3. feedback_votes table
CREATE TABLE feedback_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES feedback_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

CREATE INDEX feedback_votes_ticket_id_idx ON feedback_votes(ticket_id);
CREATE INDEX feedback_votes_user_id_idx ON feedback_votes(user_id);

ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;

-- Workspace members can see votes (via the ticket's project)
CREATE POLICY "feedback_votes_select"
  ON feedback_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM feedback_tickets ft
      WHERE ft.id = feedback_votes.ticket_id
      AND (
        ft.project_id IS NULL
        OR ft.project_id IN (SELECT public.get_user_project_ids(auth.uid()))
      )
    )
  );

-- Authenticated users can vote on tickets in their workspace
CREATE POLICY "feedback_votes_insert"
  ON feedback_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM feedback_tickets ft
      WHERE ft.id = feedback_votes.ticket_id
      AND (
        ft.project_id IS NULL
        OR ft.project_id IN (SELECT public.get_user_project_ids(auth.uid()))
      )
    )
  );

-- Users can only delete their own votes
CREATE POLICY "feedback_votes_delete"
  ON feedback_votes FOR DELETE
  USING (user_id = auth.uid());

-- 4. Seed default columns for existing projects that have feedback tickets
INSERT INTO feedback_columns (project_id, title, sort_order)
SELECT DISTINCT p.id, col.title, col.sort_order
FROM projects p
INNER JOIN feedback_tickets ft ON ft.project_id = p.id
CROSS JOIN (
  VALUES
    ('Feature requests', 0),
    ('Bugs', 1),
    ('Working on', 2),
    ('Rejected', 3)
) AS col(title, sort_order);

-- 5. Migrate existing tickets into the correct column
-- idea/feedback → "Feature requests", bug → "Bugs"
UPDATE feedback_tickets ft
SET column_id = fc.id
FROM feedback_columns fc
WHERE ft.project_id = fc.project_id
  AND fc.title = 'Feature requests'
  AND ft.category IN ('idea', 'feedback')
  AND ft.column_id IS NULL;

UPDATE feedback_tickets ft
SET column_id = fc.id
FROM feedback_columns fc
WHERE ft.project_id = fc.project_id
  AND fc.title = 'Bugs'
  AND ft.category = 'bug'
  AND ft.column_id IS NULL;
