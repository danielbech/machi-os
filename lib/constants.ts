import type { Task, BoardColumn } from "./types";
import type { WeekMode } from "./types";
import { getRollingDates, formatRollingHeader } from "./date-utils";

const ALL_COLUMN_TITLES: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function getColumnTitles(weekMode: WeekMode, boardColumns?: BoardColumn[], rollingDaysBack?: number) {
  if (weekMode === "rolling") {
    const dates = getRollingDates(rollingDaysBack ?? 0);
    return Object.fromEntries(dates.map(d => [d, formatRollingHeader(d).label]));
  }
  if (weekMode === "custom" && boardColumns) {
    return Object.fromEntries(boardColumns.map((c) => [c.id, c.title]));
  }
  if (weekMode === "7-day") return ALL_COLUMN_TITLES;
  const { saturday, sunday, ...fiveDay } = ALL_COLUMN_TITLES;
  return fiveDay;
}

export function getEmptyColumns(weekMode: WeekMode, boardColumns?: BoardColumn[], rollingDaysBack?: number): Record<string, Task[]> {
  const titles = getColumnTitles(weekMode, boardColumns, rollingDaysBack);
  return Object.fromEntries(Object.keys(titles).map((k) => [k, []]));
}
