-- Website feedback boards (one per client, shared via token)
CREATE TABLE website_feedback_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Website Feedback',
  share_token text NOT NULL DEFAULT gen_random_uuid()::text,
  statuses jsonb NOT NULL DEFAULT '["New", "In Progress", "Resolved"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_website_feedback_boards_share_token ON website_feedback_boards(share_token);
CREATE INDEX idx_website_feedback_boards_project ON website_feedback_boards(project_id);

-- RLS
ALTER TABLE website_feedback_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view feedback boards"
  ON website_feedback_boards FOR SELECT
  USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "Admins can manage feedback boards"
  ON website_feedback_boards FOR ALL
  USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));

-- Website feedback items
CREATE TABLE website_feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES website_feedback_boards(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'New',
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolution_note text,
  submitted_by text,       -- name of external submitter
  user_id uuid,            -- set when submitted internally
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_website_feedback_items_board ON website_feedback_items(board_id);

-- RLS
ALTER TABLE website_feedback_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view feedback items"
  ON website_feedback_items FOR SELECT
  USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "Admins can manage feedback items"
  ON website_feedback_items FOR ALL
  USING (project_id IN (SELECT get_user_admin_project_ids(auth.uid())));

-- Public insert policy (for shared link submissions — no auth required)
-- Uses a service-role insert from the API route instead of direct RLS bypass.
