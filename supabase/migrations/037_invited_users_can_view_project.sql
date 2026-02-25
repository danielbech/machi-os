-- Allow users with a pending invite to see the project they're invited to.
-- Without this, the join in getMyPendingInvites() returns null because
-- the invited user has no workspace_membership yet.
CREATE POLICY "Invited users can view project"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM pending_invites
      WHERE LOWER(email) = LOWER((SELECT auth.jwt()->>'email'))
    )
  );
