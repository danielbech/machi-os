-- Add active column to clients table
-- Active clients can be assigned to tasks; idle clients cannot

ALTER TABLE clients ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
