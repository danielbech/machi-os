import type { Task, BoardColumn } from "./types";
import type { WeekMode } from "./types";

const ALL_COLUMN_TITLES: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function getColumnTitles(weekMode: WeekMode, boardColumns?: BoardColumn[]) {
  if (weekMode === "custom" && boardColumns) {
    return Object.fromEntries(boardColumns.map((c) => [c.id, c.title]));
  }
  if (weekMode === "7-day") return ALL_COLUMN_TITLES;
  const { saturday, sunday, ...fiveDay } = ALL_COLUMN_TITLES;
  return fiveDay;
}

export function getEmptyColumns(weekMode: WeekMode, boardColumns?: BoardColumn[]): Record<string, Task[]> {
  const titles = getColumnTitles(weekMode, boardColumns);
  return Object.fromEntries(Object.keys(titles).map((k) => [k, []]));
}

// Backward-compatible aliases (default to 5-day)
export const COLUMN_TITLES = getColumnTitles("5-day");
export const EMPTY_COLUMNS = getEmptyColumns("5-day");
