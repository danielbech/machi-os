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
 * Shows 1 past weekday + today + 4 future weekdays (expandedDaysBack adds more past weekdays).
 * Weekend days that fall between included weekdays are inserted as separators.
 */
export function getRollingDates(expandedDaysBack: number = 0): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  // Collect past weekdays (1 + expandedDaysBack)
  const pastCount = 1 + expandedDaysBack;
  const pastDates: Date[] = [];
  let offset = -1;
  while (pastDates.length < pastCount) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    if (!isWeekend(d)) pastDates.unshift(d);
    offset--;
  }

  // Collect future weekdays (4 after today, today itself counts if it's a weekday)
  const futureDates: Date[] = [];
  // Always include today even if weekend (rare edge: user opens on weekend)
  if (!isWeekend(today)) futureDates.push(new Date(today));
  offset = 1;
  while (futureDates.length < 5) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    if (!isWeekend(d)) futureDates.push(d);
    offset++;
  }

  // Build the full range from first past date to last future date,
  // including all calendar days (weekends show as separators)
  const startDate = pastDates[0];
  const endDate = futureDates[futureDates.length - 1];
  const dates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(toLocalISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Format an ISO date for a rolling column header */
export function formatRollingHeader(isoDate: string): { label: string; dayName: string; monthDay: string; isToday: boolean; isPast: boolean } {
  const parts = isoDate.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const todayISO = getTodayISO();
  const dayName = SHORT_DAYS[date.getDay()];
  const monthDay = `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
  return {
    label: `${dayName} ${monthDay}`,
    dayName,
    monthDay,
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
