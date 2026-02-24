-- Feedback tickets: scope visibility to workspace co-members + add admin role column
-- Previously ALL authenticated users could see ALL feedback globally

-- Add project_id to feedback_tickets for workspace scoping
ALTER TABLE feedback_tickets ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

-- Create index for workspace-scoped queries
CREATE INDEX IF NOT EXISTS feedback_tickets_project_id_idx ON feedback_tickets(project_id);

-- Drop old global select policy
DROP POLICY IF EXISTS "feedback_tickets_select_all" ON feedback_tickets;

-- New: users can see feedback from their own workspaces, or global feedback (null project_id)
CREATE POLICY "feedback_tickets_select_workspace"
  ON feedback_tickets FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      project_id IS NULL
      OR project_id IN (SELECT public.get_user_project_ids(auth.uid()))
    )
  );

-- Drop old hardcoded owner policies
DROP POLICY IF EXISTS "feedback_tickets_update_owners" ON feedback_tickets;
DROP POLICY IF EXISTS "feedback_tickets_delete_owners" ON feedback_tickets;

-- New: workspace owners/admins can manage any ticket in their workspace
CREATE POLICY "feedback_tickets_update_admins"
  ON feedback_tickets FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (
      project_id IN (SELECT public.get_user_admin_project_ids(auth.uid()))
    )
  );

CREATE POLICY "feedback_tickets_delete_admins"
  ON feedback_tickets FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      project_id IN (SELECT public.get_user_admin_project_ids(auth.uid()))
    )
  );
