-- Allow users to DELETE pending invites addressed to their own email.
-- This lets them accept (delete after inserting membership) or decline (just delete).
CREATE POLICY "Users can delete own invites"
  ON pending_invites
  FOR DELETE
  USING (
    email = (SELECT auth.jwt()->>'email')
  );

-- Allow users to insert a workspace membership for themselves
-- when a pending invite exists for their email on that project.
-- This is the "accept invite" path — the client inserts the membership,
-- then deletes the invite.
CREATE POLICY "Users can join via invite"
  ON workspace_memberships FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pending_invites
      WHERE pending_invites.project_id = workspace_memberships.project_id
        AND pending_invites.email = (SELECT auth.jwt()->>'email')
    )
  );
