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
