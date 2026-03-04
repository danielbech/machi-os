-- Compound index for loading tasks by area, ordered by sort_order
-- This is the primary query pattern used by the kanban board
CREATE INDEX IF NOT EXISTS idx_tasks_area_sort ON tasks(area_id, sort_order);

-- Index for backlog queries (tasks without a day assigned)
CREATE INDEX IF NOT EXISTS idx_tasks_area_day ON tasks(area_id, day);
