import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { utcDateOnly, extractTimeOnly } from '@/lib/date-format'

/**
 * Normalizes existing WorkOrder dates to the new date-only model.
 *
 * Legacy WOs stored date+time in a single DateTime column:
 *   - WorkOrderForm sent `startDate + 'T00:00'` (default) and `dueDate + 'T12:00'` (default)
 *   - the request form sent pure `yyyy-mm-dd` (already UTC midnight)
 *
 * This script:
 *   1. Pins `startDate` / `dueDate` to UTC midnight of their stored UTC day.
 *   2. Copies the stored wall-clock time into the new `startTime` / `dueTime`
 *      columns, UNLESS it matches the legacy auto-applied default (T00:00 for
 *      start, T12:00 for due) — those never represented a real user time.
 *   3. Leaves already-normalized rows untouched (idempotent).
 *
 * Usage:
 *   npm run db:normalize-dates                 # apply
 *   npm run db:normalize-dates -- --dry-run    # preview only
 *   npm run db:normalize-dates -- --keep-defaults  # also copy legacy default times
 */

const DRY_RUN = process.argv.includes('--dry-run')
const KEEP_DEFAULTS = process.argv.includes('--keep-defaults')

const LEGACY_DEFAULT: Record<'startTime' | 'dueTime', string | null> = {
  startTime: '00:00',
  dueTime: '12:00',
}

function timeFor(
  stored: Date | null,
  field: 'startTime' | 'dueTime'
): string | null {
  const t = extractTimeOnly(stored)
  if (!t) return null
  if (!KEEP_DEFAULTS && t === LEGACY_DEFAULT[field]) return null
  return t
}

async function main(): Promise<void> {
  const prisma = new PrismaClient()

  try {
    const wos = await prisma.workOrder.findMany({
      select: { id: true, woNumber: true, startDate: true, dueDate: true, startTime: true, dueTime: true },
      orderBy: { createdAt: 'asc' },
    })

    let changed = 0
    const plan = wos.map((wo) => {
      const startDate = utcDateOnly(wo.startDate) ?? undefined
      const dueDate = utcDateOnly(wo.dueDate) ?? undefined
      const startTime = wo.startTime ?? timeFor(wo.startDate, 'startTime')
      const dueTime = wo.dueTime ?? timeFor(wo.dueDate, 'dueTime')

      const touchesDate =
        (wo.startDate && utcDateOnly(wo.startDate) && !wo.startDate.toISOString().endsWith('T00:00:00.000Z')) ||
        (wo.dueDate && utcDateOnly(wo.dueDate) && !wo.dueDate.toISOString().endsWith('T00:00:00.000Z'))
      const touchesTime = startTime !== wo.startTime || dueTime !== wo.dueTime

      if (!touchesDate && !touchesTime) return null

      return {
        where: { id: wo.id },
        data: {
          ...(startDate ? { startDate: new Date(startDate + 'T00:00:00.000Z') } : {}),
          ...(dueDate ? { dueDate: new Date(dueDate + 'T00:00:00.000Z') } : {}),
          ...(startTime !== wo.startTime ? { startTime } : {}),
          ...(dueTime !== wo.dueTime ? { dueTime } : {}),
        },
        label: `${wo.woNumber}: start ${wo.startDate?.toISOString() ?? '—'}→${startDate ?? '—'} (${startTime ?? '—'}) · due ${wo.dueDate?.toISOString() ?? '—'}→${dueDate ?? '—'} (${dueTime ?? '—'})`,
      }
    }).filter((x): x is NonNullable<typeof x> => x !== null)

    changed = plan.length

    for (const p of plan) console.log(`${DRY_RUN ? '[dry] ' : ''}${p.label}`)

    if (DRY_RUN) {
      console.log(`\nDry run: ${changed} of ${wos.length} work orders would be updated.`)
      return
    }

    if (changed === 0) {
      console.log('Nothing to normalize — all work orders already date-only.')
      return
    }

    for (const p of plan) await prisma.workOrder.update({ where: p.where, data: p.data })

    console.log(`\nNormalized ${changed} of ${wos.length} work orders.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  console.error('Normalization failed:', err)
  process.exitCode = 1
})
