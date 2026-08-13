const DAY_MS = 24 * 60 * 60 * 1000

const pad = (n: number) => String(n).padStart(2, '0')

export function dateOnlyToUtcMidnight(ymd: string | null | undefined): Date | null {
  if (!ymd) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const [y, m, d] = ymd.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return utcDateOnly(dt) === ymd ? dt : null
}

export function utcDateOnly(date: Date | string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function localDateOnly(date: Date | string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayLocal(): string {
  const now = new Date()
  return localDateOnly(now)!
}

export function todayUTC(): string {
  const now = new Date()
  return utcDateOnly(now)!
}

export function isOverdueByDate(dueDate: Date | string | null | undefined, today: string): boolean {
  if (!dueDate) return false
  const ymd = utcDateOnly(dueDate)
  if (!ymd) return false
  return ymd < today
}

export function isValidTime(hhmm: string | null | undefined): boolean {
  if (!hhmm) return true
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)
}

export function extractTimeOnly(date: Date | string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function fmtDateOnly(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  return new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }).format(dateOnlyToUtcMidnight(ymd)!)
}

export function fmtScheduledTime(hhmm: string | null | undefined): string | null {
  if (!hhmm || !isValidTime(hhmm)) return null
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:${pad(m)} ${ampm}`
}

export function startOfLocalDay(date: Date | string): Date {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function startOfUtcDay(date: Date | string): Date {
  const d = new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

export function endOfUtcDay(date: Date | string): Date {
  return new Date(startOfUtcDay(date).getTime() + DAY_MS - 1)
}
