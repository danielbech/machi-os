-- Cleanup: remove DB objects from features that no longer exist in the app
-- (multi-workspace invites, board view modes, custom board columns)

-- 1. Drop pending_invites table and related functions
DROP TABLE IF EXISTS pending_invites CASCADE;
DROP FUNCTION IF EXISTS get_user_id_by_email(text);
DROP FUNCTION IF EXISTS accept_pending_invites(uuid);

-- 2. Drop board_columns table (custom column feature removed)
DROP TABLE IF EXISTS board_columns CASCADE;

-- 3. Remove unused columns from projects (board view modes removed — now rolling-only)
ALTER TABLE projects
  DROP COLUMN IF EXISTS week_mode,
  DROP COLUMN IF EXISTS transition_day,
  DROP COLUMN IF EXISTS transition_hour;
