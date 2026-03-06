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

// ─── Currency ───────────────────────────────────────────────────────────────

export const CURRENCIES = [
  { code: 'DKK', label: 'DKK — Danish Krone', symbol: 'kr' },
  { code: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { code: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { code: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { code: 'SEK', label: 'SEK — Swedish Krona', symbol: 'kr' },
  { code: 'NOK', label: 'NOK — Norwegian Krone', symbol: 'kr' },
] as const

export type CurrencyCode = typeof CURRENCIES[number]['code']

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol || code
}

/**
 * Format a monetary value with currency.
 * formatMoney(1500, 'DKK') → "1,500 DKK"
 */
export function formatMoney(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString()} ${currency}`
}

/**
 * Convert an amount to DKK using the stored exchange rate.
 * The exchange_rate is "how many DKK per 1 unit of this currency".
 */
export function toDKK(amount: number, exchangeRate: number): number {
  return amount * exchangeRate
}

/**
 * Fetch the current exchange rate from the Frankfurter API (ECB data).
 * Returns how many DKK per 1 unit of `fromCurrency`.
 * Returns null if the fetch fails.
 */
export async function fetchExchangeRate(fromCurrency: string): Promise<number | null> {
  if (fromCurrency === 'DKK') return 1
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${fromCurrency}&symbols=DKK`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.rates?.DKK ?? null
  } catch {
    return null
  }
}
