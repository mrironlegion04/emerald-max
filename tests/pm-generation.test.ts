import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { advanceDate, computeNextDueDate, snapToRecurrence, handleWOCompletion } from '@/lib/pm-generation'

vi.mock('@/lib/db', () => ({
  prisma: {
    workOrder: { findUnique: vi.fn() },
    maintenanceSchedule: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`

describe('advanceDate', () => {
  it('advances HOURLY by interval hours', () => {
    const d = new Date('2026-01-01T00:00:00Z')
    expect(advanceDate(d, 'HOURLY', 6).toISOString()).toBe('2026-01-01T06:00:00.000Z')
  })

  it('advances DAILY by interval days', () => {
    const d = new Date('2026-01-31T10:00:00Z')
    expect(advanceDate(d, 'DAILY', 1).getUTCDate()).toBe(1) // Feb 1
  })

  it('advances WEEKLY by interval weeks', () => {
    const d = new Date('2026-01-01T00:00:00Z')
    expect(advanceDate(d, 'WEEKLY', 2).toISOString()).toBe('2026-01-15T00:00:00.000Z')
  })

  it('handles MONTHLY month-end overflow without skipping to the next month', () => {
    const d = new Date('2026-01-31T00:00:00Z')
    const next = advanceDate(d, 'MONTHLY', 1)
    expect(next.getUTCFullYear()).toBe(2026)
    expect(next.getUTCMonth()).toBe(1) // February
    expect(next.getUTCDate()).toBe(28) // clamped to Feb 28
  })

  it('applies NTH_WEEKDAY monthly recurrence', () => {
    const d = new Date('2026-01-05T00:00:00Z') // Jan 5
    // 1st Monday of every 1 month
    const next = advanceDate(d, 'MONTHLY', 1, { type: 'NTH_WEEKDAY', dayOfWeek: 1, occurrence: 1 })
    expect(ymd(next)).toBe('2026-02-02') // first Monday of Feb
  })

  it('applies DAY_OF_MONTH recurrence with last-day clamping', () => {
    const d = new Date('2026-01-10T00:00:00Z')
    const next = advanceDate(d, 'MONTHLY', 1, { type: 'DAY_OF_MONTH', dayOfMonth: 31 })
    expect(ymd(next)).toBe('2026-02-28') // Feb has no 31st
  })

  it('advances QUARTERLY and YEARLY', () => {
    const d = new Date('2026-01-15T00:00:00Z')
    expect(advanceDate(d, 'QUARTERLY', 1).getUTCMonth()).toBe(3)
    expect(advanceDate(d, 'YEARLY', 1).getUTCFullYear()).toBe(2027)
  })
})

describe('computeNextDueDate / snapToRecurrence', () => {
  it('snaps a start date to the first conformant recurrence date', () => {
    const start = new Date('2026-01-03T00:00:00Z') // Saturday
    const due = computeNextDueDate(start, 'MONTHLY', 1, {
      type: 'NTH_WEEKDAY',
      dayOfWeek: 1, // Monday
      occurrence: 1,
    })
    expect(ymd(due)).toBe('2026-01-05')
  })

  it('returns the start date unchanged when no monthly rule applies', () => {
    const start = new Date('2026-01-03T00:00:00Z')
    expect(computeNextDueDate(start, 'DAILY', 1, null)).toEqual(start)
  })

  it('snapToRecurrence rolls into the next month when the current month is in the past', () => {
    const start = new Date('2026-01-20T00:00:00Z')
    const snapped = snapToRecurrence(start, { type: 'DAY_OF_MONTH', dayOfMonth: 15 })
    expect(ymd(snapped)).toBe('2026-02-15')
  })
})

describe('handleWOCompletion', () => {
  const prismaMock = prisma as unknown as {
    workOrder: { findUnique: ReturnType<typeof vi.fn> }
    maintenanceSchedule: {
      findUnique: ReturnType<typeof vi.fn>
      update: ReturnType<typeof vi.fn>
    }
  }

  beforeEach(() => vi.clearAllMocks())

  it('does nothing when the WO has no linked schedule', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue({ maintenanceScheduleId: null })
    await handleWOCompletion('wo-1')
    expect(prismaMock.maintenanceSchedule.findUnique).not.toHaveBeenCalled()
  })

  it('reschedules a FLOATING schedule from the completion date', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue({ maintenanceScheduleId: 'sched-1' })
    prismaMock.maintenanceSchedule.findUnique.mockResolvedValue({
      scheduleBehavior: 'FLOATING',
      frequency: 'DAILY',
      interval: 2,
      nextDueDate: new Date('2026-01-01T00:00:00Z'),
      recurrenceRule: null,
      endDate: null,
    })

    await handleWOCompletion('wo-1')

    const updateArgs = prismaMock.maintenanceSchedule.update.mock.calls[0][0] as unknown as {
      where: { id: string }
      data: { nextDueDate: Date }
    }
    const due = updateArgs.data.nextDueDate as Date
    expect(updateArgs.where.id).toBe('sched-1')
    expect(due.getTime()).toBeGreaterThan(Date.now() - 10000)
  })

  it('deactivates the schedule when the next due date passes the end date', async () => {
    prismaMock.workOrder.findUnique.mockResolvedValue({ maintenanceScheduleId: 'sched-1' })
    prismaMock.maintenanceSchedule.findUnique.mockResolvedValue({
      scheduleBehavior: 'FLOATING',
      frequency: 'DAILY',
      interval: 1,
      nextDueDate: new Date('2026-01-01T00:00:00Z'),
      recurrenceRule: null,
      endDate: new Date('2000-01-01T00:00:00Z'),
    })

    await handleWOCompletion('wo-1')

    const updateArgs = prismaMock.maintenanceSchedule.update.mock.calls[0][0] as unknown as {
      data: { isActive: boolean }
    }
    expect(updateArgs.data.isActive).toBe(false)
  })
})
