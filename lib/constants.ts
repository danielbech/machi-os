import type { Task } from "./types";
import { getRollingDates, formatRollingHeader } from "./date-utils";

export function getColumnTitles(rollingDaysBack?: number) {
  const dates = getRollingDates(rollingDaysBack ?? 0);
  return Object.fromEntries(dates.map(d => [d, formatRollingHeader(d).label]));
}

export function getEmptyColumns(rollingDaysBack?: number): Record<string, Task[]> {
  const titles = getColumnTitles(rollingDaysBack);
  return Object.fromEntries(Object.keys(titles).map((k) => [k, []]));
}
