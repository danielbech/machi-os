-- Make feedback platform-wide instead of workspace-scoped
-- All authenticated users can see and contribute to the same feedback board

-- 1. Make feedback_columns.project_id nullable (global columns have no project)
ALTER TABLE feedback_columns ALTER COLUMN project_id DROP NOT NULL;

-- 2. Nullify existing project_id on columns and tickets so everything is global
UPDATE feedback_columns SET project_id = NULL;
UPDATE feedback_tickets SET project_id = NULL;

-- 3. Replace feedback_columns RLS policies — open to all authenticated users
DROP POLICY IF EXISTS "feedback_columns_select" ON feedback_columns;
CREATE POLICY "feedback_columns_select"
  ON feedback_columns FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "feedback_columns_insert" ON feedback_columns;
CREATE POLICY "feedback_columns_insert"
  ON feedback_columns FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "feedback_columns_update" ON feedback_columns;
CREATE POLICY "feedback_columns_update"
  ON feedback_columns FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "feedback_columns_delete" ON feedback_columns;
CREATE POLICY "feedback_columns_delete"
  ON feedback_columns FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 4. Replace feedback_tickets RLS policies — all authenticated users can read,
--    creators + any workspace admin can manage
DROP POLICY IF EXISTS "feedback_tickets_select_workspace" ON feedback_tickets;
CREATE POLICY "feedback_tickets_select_global"
  ON feedback_tickets FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "feedback_tickets_insert_own" ON feedback_tickets;
CREATE POLICY "feedback_tickets_insert_own"
  ON feedback_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "feedback_tickets_update_admins" ON feedback_tickets;
CREATE POLICY "feedback_tickets_update_own"
  ON feedback_tickets FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "feedback_tickets_delete_admins" ON feedback_tickets;
CREATE POLICY "feedback_tickets_delete_own"
  ON feedback_tickets FOR DELETE
  USING (user_id = auth.uid());

-- 5. Replace feedback_votes RLS policies — open to all authenticated users
DROP POLICY IF EXISTS "feedback_votes_select" ON feedback_votes;
CREATE POLICY "feedback_votes_select"
  ON feedback_votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "feedback_votes_insert" ON feedback_votes;
CREATE POLICY "feedback_votes_insert"
  ON feedback_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- feedback_votes_delete already correct (user_id = auth.uid())
