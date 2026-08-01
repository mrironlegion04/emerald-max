import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { buildLocationFilter, buildWOVisibilityFilter } from '@/lib/access-control'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const woFilter = await buildWOVisibilityFilter(user)
  const pmFilter = await buildLocationFilter(user)
  const assetFilter = await buildLocationFilter(user)
  const woWhere = (extra: Record<string, unknown> = {}) => ({ ...(woFilter ?? {}), ...extra })

  const { searchParams } = new URL(req.url)
  const preset = searchParams.get('preset') ?? 'this_month'

  const now = new Date()
  let start: Date
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  switch (preset) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case 'this_week': {
      const d = new Date(now)
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      break
    }
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'last_30_days':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case 'this_quarter': {
      const q = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), q * 3, 1)
      break
    }
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1)
      break
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // Work order counts
  const [
    createdWOs, completedWOs, closedWOs, openWOs, inProgressWOs, onHoldWOs, cancelledWOs,
  ] = await Promise.all([
    prisma.workOrder.count({ where: woWhere({ createdAt: { gte: start, lte: end } }) }),
    prisma.workOrder.count({ where: woWhere({ completedAt: { gte: start, lte: end } }) }),
    prisma.workOrder.count({ where: woWhere({ status: 'CLOSED' }) }),
    prisma.workOrder.count({ where: woWhere({ status: 'OPEN' }) }),
    prisma.workOrder.count({ where: woWhere({ status: 'IN_PROGRESS' }) }),
    prisma.workOrder.count({ where: woWhere({ status: 'ON_HOLD' }) }),
    prisma.workOrder.count({ where: woWhere({ status: 'CANCELLED' }) }),
  ])

  const overdueWOs = await prisma.workOrder.count({
    where: woWhere({ status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED'] }, dueDate: { lt: now } }),
  })

  const totalActive = openWOs + inProgressWOs + onHoldWOs + completedWOs + closedWOs + cancelledWOs
  const onTimeCount = Math.max(0, totalActive - overdueWOs)

  // Groupings
  const [wosByType, wosByPriority] = await Promise.all([
    prisma.workOrder.groupBy({
      by: ['type'],
      where: woWhere({ createdAt: { gte: start, lte: end } }),
      _count: true,
    }),
    prisma.workOrder.groupBy({
      by: ['priority'],
      where: woWhere({ createdAt: { gte: start, lte: end } }),
      _count: true,
    }),
  ])

  // Created vs Completed chart data
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const useMonthGrouping = days > 62

  const chartWOs = await prisma.workOrder.findMany({
    where: woWhere({
      OR: [
        { createdAt: { gte: start, lte: end } },
        { completedAt: { gte: start, lte: end }, status: { in: ['COMPLETED', 'CLOSED'] } },
      ],
    }),
    select: { createdAt: true, completedAt: true, status: true },
  })

  const periodKey = (d: Date) =>
    useMonthGrouping ? d.toISOString().slice(0, 7) : d.toISOString().slice(0, 10)

  const chartMap: Record<string, { created: number; completed: number }> = {}
  for (const wo of chartWOs) {
    if (wo.createdAt >= start && wo.createdAt <= end) {
      const k = periodKey(wo.createdAt)
      chartMap[k] = { created: (chartMap[k]?.created ?? 0) + 1, completed: chartMap[k]?.completed ?? 0 }
    }
    if (wo.completedAt && wo.completedAt >= start && wo.completedAt <= end && ['COMPLETED', 'CLOSED'].includes(wo.status)) {
      const k = periodKey(wo.completedAt)
      chartMap[k] = { created: chartMap[k]?.created ?? 0, completed: (chartMap[k]?.completed ?? 0) + 1 }
    }
  }
  const createdVsCompleted = Object.entries(chartMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => ({ period, ...data }))

  // Asset health — fleet-weighted metrics computed from source data
  const [totalAssets, assetsByStatus, fleetAssets] = await Promise.all([
    prisma.asset.count({ where: { ...(assetFilter ?? {}), isDeleted: false } }),
    prisma.asset.groupBy({ by: ['status'], where: { ...(assetFilter ?? {}), isDeleted: false }, _count: true }),
    prisma.asset.findMany({
      where: { ...(assetFilter ?? {}), isDeleted: false },
      select: { totalFailures: true, totalRepairTime: true, totalDowntimeMinutes: true },
    }),
  ])

  const fleetTotalFailures = fleetAssets.reduce((s, a) => s + a.totalFailures, 0)
  const fleetTotalRepairTime = fleetAssets.reduce((s, a) => s + a.totalRepairTime, 0)
  const avgMttrMinutes = fleetTotalFailures > 0 ? Math.floor(fleetTotalRepairTime / fleetTotalFailures) : 0

  // PM + costs + top assignees
  const [overduePM, dueSoonPM, costSums, topAssigneeRows] = await Promise.all([
    prisma.maintenanceSchedule.count({ where: { ...(pmFilter ?? {}), isActive: true, nextDueDate: { lt: now } } }),
    prisma.maintenanceSchedule.count({
      where: { ...(pmFilter ?? {}), isActive: true, nextDueDate: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.workOrder.aggregate({
      where: woWhere({ status: { in: ['COMPLETED', 'CLOSED'] }, completedAt: { gte: start, lte: end } }),
      _sum: { laborCost: true, partsCost: true },
    }),
    prisma.workOrder.groupBy({
      by: ['assignedToId'],
      where: woWhere({ status: { in: ['COMPLETED', 'CLOSED'] }, completedAt: { gte: start, lte: end }, assignedToId: { not: null } }),
      _count: true,
      orderBy: { _count: { assignedToId: 'desc' } },
      take: 5,
    }),
  ])

  const assigneeIds = topAssigneeRows.map((a: { assignedToId: string | null }) => a.assignedToId).filter(Boolean) as string[]
  const assignees = assigneeIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : []
  const assigneeMap = Object.fromEntries(assignees.map(a => [a.id, a.name]))

  return NextResponse.json({
    range: { start: start.toISOString(), end: end.toISOString(), preset },
    kpis: {
      totalWOs: createdWOs,
      completedWOs,
      closedWOs,
      openWOs,
      inProgressWOs,
      onHoldWOs,
      cancelledWOs,
      overdueWOs,
      totalLaborCost: costSums._sum.laborCost ?? 0,
      totalPartsCost: costSums._sum.partsCost ?? 0,
    },
    onTimeOverdue: {
      onTime: onTimeCount,
      overdue: overdueWOs,
    },
    byType: wosByType.map(t => ({ type: t.type, count: t._count })),
    byPriority: wosByPriority.map(p => ({ priority: p.priority, count: p._count })),
    createdVsCompleted,
    assets: {
      total: totalAssets,
      byStatus: assetsByStatus.map(s => ({ status: s.status, count: s._count })),
      avgMttrMinutes,
      totalFailures: fleetTotalFailures,
      totalDowntimeMinutes: fleetAssets.reduce((s, a) => s + a.totalDowntimeMinutes, 0),
    },
    pm: { overdue: overduePM, dueSoon: dueSoonPM },
    topAssignees: topAssigneeRows.map((a: { assignedToId: string | null; _count: number }) => ({
      name: assigneeMap[a.assignedToId ?? ''] ?? 'Unknown',
      count: a._count,
    })),
  })
}
