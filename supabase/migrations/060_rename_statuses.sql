-- Rename "Upcoming" → "Planned" and "Expected" → "Prospect"
UPDATE client_statuses SET name = 'Planned' WHERE name = 'Upcoming';
UPDATE client_statuses SET name = 'Prospect' WHERE name = 'Expected';
