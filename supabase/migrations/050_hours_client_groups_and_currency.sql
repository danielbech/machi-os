-- Fix: change client_id FK from clients to client_groups (client_groups are the actual "clients")
-- and add multi-currency support with DKK conversion rate

-- 1. invoice_groups: drop old FK, add new FK, add currency columns
ALTER TABLE invoice_groups
  DROP CONSTRAINT IF EXISTS invoice_groups_client_id_fkey;

ALTER TABLE invoice_groups
  ADD CONSTRAINT invoice_groups_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES client_groups(id) ON DELETE CASCADE;

ALTER TABLE invoice_groups
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'DKK',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(10, 4) NOT NULL DEFAULT 1.0;

-- 2. hour_entries: drop old FK, add new FK
ALTER TABLE hour_entries
  DROP CONSTRAINT IF EXISTS hour_entries_client_id_fkey;

ALTER TABLE hour_entries
  ADD CONSTRAINT hour_entries_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES client_groups(id) ON DELETE CASCADE;
