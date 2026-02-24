-- Add reaction types to feedback_votes (thumbsup, heart, fire)
-- One vote per user per reaction type per ticket

ALTER TABLE feedback_votes ADD COLUMN IF NOT EXISTS reaction_type text NOT NULL DEFAULT 'thumbsup';

-- Drop old unique constraint (one vote per user per ticket)
ALTER TABLE feedback_votes DROP CONSTRAINT IF EXISTS feedback_votes_ticket_id_user_id_key;

-- New unique constraint: one vote per user per reaction type per ticket
ALTER TABLE feedback_votes ADD CONSTRAINT feedback_votes_ticket_user_reaction_key
  UNIQUE(ticket_id, user_id, reaction_type);
