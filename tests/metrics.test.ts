import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import { updateAssetMetrics, formatMinutes, formatDays } from '@/lib/metrics'

vi.mock('@/lib/db', () => ({
  prisma: {
    workOrder: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    repairSession: { findMany: vi.fn() },
    asset: { update: vi.fn() },
  },
}))

describe('formatMinutes / formatDays', () => {
  it('formats minutes as hours/minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1h 0m')
  })

  it('formats days with friendly units', () => {
    expect(formatDays(3)).toBe('3 days')
    expect(formatDays(12)).toBe('2 weeks')
  })
})

describe('updateAssetMetrics', () => {
  const prismaMock = prisma as unknown as {
    workOrder: { count: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }
    repairSession: { findMany: ReturnType<typeof vi.fn> }
    asset: { update: ReturnType<typeof vi.fn> }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.workOrder.count.mockResolvedValue(2)
    prismaMock.workOrder.findFirst.mockImplementation(async ({ orderBy }: { orderBy: { completedAt?: string } }) =>
      orderBy.completedAt === 'desc' ? { completedAt: new Date('2026-01-10T00:00:00Z') } : null
    )
    prismaMock.repairSession.findMany.mockResolvedValue([
      { durationMinutes: 30 },
      { durationMinutes: 90 },
    ])
  })

  it('counts COMPLETED and CLOSED breakdowns as failures', async () => {
    prismaMock.workOrder.findMany.mockResolvedValue([])
    await updateAssetMetrics('asset-1')

    const countArgs = prismaMock.workOrder.count.mock.calls[0][0] as unknown as {
      where: { status: { in: string[] }; type: string }
    }
    expect(countArgs.where.status.in).toEqual(['COMPLETED', 'CLOSED'])
    expect(countArgs.where.type).toBe('BREAKDOWN')
  })

  it('accumulates downtime from completed work orders only', async () => {
    const start = new Date('2026-01-10T08:00:00Z')
    const end = new Date('2026-01-10T09:30:00Z')
    prismaMock.workOrder.findMany.mockResolvedValue([
      { createdAt: start, completedAt: end, downtimeStartedAt: null, downtimeEndedAt: null },
    ])

    await updateAssetMetrics('asset-1')

    const updateArgs = prismaMock.asset.update.mock.calls[0][0] as unknown as {
      data: {
        totalDowntimeMinutes: number
        totalRepairTime: number
        totalFailures: number
        lastFailureDate: Date
      }
    }
    expect(updateArgs.data.totalDowntimeMinutes).toBe(90)
    expect(updateArgs.data.totalRepairTime).toBe(120)
    expect(updateArgs.data.totalFailures).toBe(2)
    expect(updateArgs.data.lastFailureDate).toEqual(new Date('2026-01-10T00:00:00Z'))
  })

  it('ignores empty/negative downtime windows', async () => {
    const start = new Date('2026-01-10T08:00:00Z')
    prismaMock.workOrder.findMany.mockResolvedValue([
      { createdAt: start, completedAt: start, downtimeStartedAt: null, downtimeEndedAt: null },
    ])

    await updateAssetMetrics('asset-1')

    const updateArgs = prismaMock.asset.update.mock.calls[0][0] as unknown as {
      data: { totalDowntimeMinutes: number }
    }
    expect(updateArgs.data.totalDowntimeMinutes).toBe(0)
  })
})
