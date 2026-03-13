-- Rename "Upcoming" → "Planned" and "Expected" → "Prospect" (with pink color)
UPDATE client_statuses SET name = 'Planned' WHERE name = 'Upcoming';
UPDATE client_statuses SET name = 'Prospect', color = 'pink' WHERE name = 'Expected';
