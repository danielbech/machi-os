-- Feedback tickets: global table for ideas, bugs, and general feedback
CREATE TABLE IF NOT EXISTS feedback_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'feedback' CHECK (category IN ('idea', 'bug', 'feedback')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE feedback_tickets ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all tickets
CREATE POLICY "feedback_tickets_select_all"
  ON feedback_tickets FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can insert their own tickets
CREATE POLICY "feedback_tickets_insert_own"
  ON feedback_tickets FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Creator can update their own tickets
CREATE POLICY "feedback_tickets_update_own"
  ON feedback_tickets FOR UPDATE
  USING (user_id = auth.uid());

-- Creator can delete their own tickets
CREATE POLICY "feedback_tickets_delete_own"
  ON feedback_tickets FOR DELETE
  USING (user_id = auth.uid());

-- Platform owners (Daniel & Casper) can update any ticket
CREATE POLICY "feedback_tickets_update_owners"
  ON feedback_tickets FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT au.id FROM auth.users au
      WHERE au.email IN ('daniel@oimachi.co', 'casper@oimachi.co')
    )
  );

-- Platform owners (Daniel & Casper) can delete any ticket
CREATE POLICY "feedback_tickets_delete_owners"
  ON feedback_tickets FOR DELETE
  USING (
    auth.uid() IN (
      SELECT au.id FROM auth.users au
      WHERE au.email IN ('daniel@oimachi.co', 'casper@oimachi.co')
    )
  );

-- Index for faster queries
CREATE INDEX feedback_tickets_created_at_idx ON feedback_tickets(created_at DESC);
CREATE INDEX feedback_tickets_user_id_idx ON feedback_tickets(user_id);
