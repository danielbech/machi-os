-- Add configurable transition day and hour to projects
-- transition_day: JS getDay() convention (0=Sun, 1=Mon, ... 5=Fri, 6=Sat). Default 5 (Friday).
-- transition_hour: 0–23. Default 17.

ALTER TABLE projects
  ADD COLUMN transition_day integer NOT NULL DEFAULT 5,
  ADD COLUMN transition_hour integer NOT NULL DEFAULT 17;
