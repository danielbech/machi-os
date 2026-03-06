/**
 * Parse a forgiving time input string into total minutes.
 * Accepts: "1:30" → 90, "1h30m" → 90, "1h30" → 90, "1h" → 60,
 *          "90" → 90 (plain number = minutes), "1.5" → 90 (decimal = hours)
 * Returns null if the input can't be parsed.
 */
export function parseTimeInput(input: string): number | null {
  const s = input.trim()
  if (!s) return null

  // "1:30" format
  const colonMatch = s.match(/^(\d+):(\d{1,2})$/)
  if (colonMatch) {
    return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2])
  }

  // "1h30m" or "1h30" or "1h" or "30m"
  const hhmm = s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m?)?$/i)
  if (hhmm && (hhmm[1] || hhmm[2])) {
    const h = parseInt(hhmm[1] || '0')
    const m = parseInt(hhmm[2] || '0')
    return h * 60 + m
  }

  // Plain number — if it contains a dot, treat as decimal hours, otherwise minutes
  const num = parseFloat(s)
  if (!isNaN(num) && num >= 0) {
    if (s.includes('.')) {
      return Math.round(num * 60)
    }
    return Math.round(num)
  }

  return null
}

/**
 * Format minutes into a readable duration string.
 * 90 → "1h 30m", 45 → "0h 45m", 0 → "0h 0m"
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}m`
}

/**
 * Format minutes as decimal hours for summaries.
 * 90 → "1.5", 45 → "0.75"
 */
export function formatHoursDecimal(minutes: number): string {
  return (minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)
}

/**
 * Format a date string (YYYY-MM-DD) as a short readable date.
 * "2026-03-07" → "Mar 7"
 */
export function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getMonth()]} ${date.getDate()}`
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Get the default invoice group name for the current month.
 * Returns e.g. "March 2026"
 */
export function defaultGroupName(): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const now = new Date()
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}
