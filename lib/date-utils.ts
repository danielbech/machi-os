import type { WeekMode } from "@/lib/types";

/** Get the raw current week's Monday (no transition offset) */
export function getCurrentMonday() {
  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  const offset = currentDay === 0 ? -6 : 1 - currentDay;
  monday.setDate(today.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Check if we should show next week (transition ran + still on/after transition day) */
export function isTransitionedToNextWeek(transitionDay: number) {
  if (typeof window === "undefined") return false;
  const monday = getCurrentMonday();
  const marker = localStorage.getItem("flowie-last-transition");
  const currentDay = new Date().getDay();
  const inPostTransitionWindow = transitionDay === 0
    ? currentDay === 0
    : currentDay >= transitionDay || currentDay === 0;
  return marker === monday.toISOString() && inPostTransitionWindow;
}

/** Get the display week's Monday, accounting for transition offset */
export function getDisplayMonday(transitionDay: number) {
  const monday = getCurrentMonday();
  if (isTransitionedToNextWeek(transitionDay)) {
    monday.setDate(monday.getDate() + 7);
  }
  return monday;
}

/** Get the start (Monday) and end date for the current display week */
export function getWeekRange(weekMode: WeekMode = "5-day", transitionDay: number = 5) {
  const monday = getDisplayMonday(transitionDay);
  const endDay = new Date(monday);
  endDay.setDate(monday.getDate() + (weekMode === "7-day" ? 6 : 4));
  endDay.setHours(23, 59, 59, 999);
  return { monday, friday: endDay };
}

// --- Rolling mode utilities ---

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Convert a Date to local ISO date string (YYYY-MM-DD) */
export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Get today's local ISO date string */
export function getTodayISO(): string {
  return toLocalISO(new Date());
}

/**
 * Get ISO date strings for the rolling window.
 * Default: yesterday + today + next 3 days = 5 visible columns.
 * expandedDaysBack: how many extra past days to show (0–6).
 */
export function getRollingDates(expandedDaysBack: number = 0): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: string[] = [];
  // Start from (1 + expandedDaysBack) days ago
  const startOffset = -(1 + expandedDaysBack);
  // End at today + 3 (4 future days including today)
  for (let i = startOffset; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(toLocalISO(d));
  }
  return dates;
}

/** Format an ISO date for a rolling column header */
export function formatRollingHeader(isoDate: string): { label: string; isToday: boolean; isPast: boolean } {
  const parts = isoDate.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const todayISO = getTodayISO();
  const dayName = SHORT_DAYS[date.getDay()];
  const monthDay = `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
  return {
    label: `${dayName} ${monthDay}`,
    isToday: isoDate === todayISO,
    isPast: isoDate < todayISO,
  };
}

/** Check if an ISO date string falls on a weekend (Saturday or Sunday) */
export function isWeekendISO(isoDate: string): boolean {
  const parts = isoDate.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Get the cutoff ISO date (7 days ago) for rolling cleanup */
export function getRollingCutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return toLocalISO(d);
}
