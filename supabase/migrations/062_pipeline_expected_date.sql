-- Change expected_month (text "YYYY-MM") to expected_date (date)
-- Existing values get day 1 appended
ALTER TABLE pipeline_items ADD COLUMN expected_date date;
UPDATE pipeline_items SET expected_date = (expected_month || '-01')::date;
ALTER TABLE pipeline_items ALTER COLUMN expected_date SET NOT NULL;
ALTER TABLE pipeline_items DROP COLUMN expected_month;
