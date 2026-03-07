-- Add sort_order to invoice_groups for drag-and-drop reordering
ALTER TABLE invoice_groups
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill existing rows: assign sort_order based on created_at (newest first = 0, 1, 2, ...)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) - 1 AS rn
  FROM invoice_groups
)
UPDATE invoice_groups
SET sort_order = numbered.rn
FROM numbered
WHERE invoice_groups.id = numbered.id;
