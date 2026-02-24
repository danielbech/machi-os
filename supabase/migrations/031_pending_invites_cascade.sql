-- Add ON DELETE CASCADE to pending_invites.invited_by
-- so deleting an auth user automatically cleans up their sent invites.
ALTER TABLE pending_invites
  DROP CONSTRAINT pending_invites_invited_by_fkey,
  ADD CONSTRAINT pending_invites_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;
