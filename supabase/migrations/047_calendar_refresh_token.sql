-- Add refresh_token column to calendar_connections for long-lived auth
ALTER TABLE calendar_connections ADD COLUMN IF NOT EXISTS refresh_token text;
