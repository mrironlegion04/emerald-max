import { prisma } from '@/lib/db'

function toMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function isInWindow(nowMin: number, start: string, end: string): boolean {
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s === e) return false
  if (e > s) return nowMin >= s && nowMin < e
  return nowMin >= s || nowMin < e // wraps past midnight
}

/**
 * Determine the shift a given time falls into, based on admin-configured
 * ShiftConfig windows (in server-local time). First active match wins.
 * Returns the shift name (e.g. "SHIFTA") or null when no window matches.
 */
export async function resolveShift(date = new Date()): Promise<string | null> {
  const configs = await prisma.shiftConfig.findMany({
    where: { isActive: true },
    orderBy: [{ startTime: 'asc' }],
  })
  if (configs.length === 0) return null

  const nowMin = date.getHours() * 60 + date.getMinutes()

  for (const c of configs) {
    if (isInWindow(nowMin, c.startTime, c.endTime)) return c.name
  }
  return null
}
