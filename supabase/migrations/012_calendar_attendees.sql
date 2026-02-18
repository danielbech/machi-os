-- Add attendees to calendar events
ALTER TABLE calendar_events ADD COLUMN attendees TEXT[] DEFAULT '{}';
