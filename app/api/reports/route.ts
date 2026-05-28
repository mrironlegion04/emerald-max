import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') ?? '6')
    const now    = new Date()

    // Build month buckets: last N months
    const monthBuckets = Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      return {
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59),
      }
    })

    const rangeStart = monthBuckets[0].start

    // All WOs in range
    const wos = await prisma.workOrder.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: {
        id: true, status: true, type: true, priority: true,
        createdAt: true, completedAt: true, dueDate: true,
        laborCost: true, partsCost: true, laborHours: true,
        assetId: true,
        asset: { select: { id: true, name: true, assetCode: true } },
      },
    })

    // ── Monthly WO counts ────────────────────────────────────────────────────
    const woByMonth = monthBuckets.map(b => {
      const inBucket = wos.filter(w => w.createdAt >= b.start && w.createdAt <= b.end)
      return {
        month:     b.label,
        created:   inBucket.length,
        completed: inBucket.filter(w => w.status === 'COMPLETED').length,
        open:      inBucket.filter(w => !['COMPLETED','CANCELLED'].includes(w.status)).length,
      }
    })

    // ── Monthly cost breakdown ───────────────────────────────────────────────
    const costByMonth = monthBuckets.map(b => {
      const completed = wos.filter(w =>
        w.completedAt && w.completedAt >= b.start && w.completedAt <= b.end
      )
      return {
        month:  b.label,
        labor:  Math.round(completed.reduce((s, w) => s + (w.laborCost ?? 0), 0)),
        parts:  Math.round(completed.reduce((s, w) => s + (w.partsCost ?? 0), 0)),
        total:  Math.round(completed.reduce((s, w) => s + (w.laborCost ?? 0) + (w.partsCost ?? 0), 0)),
      }
    })

    // ── WO by status (current snapshot) ──────────────────────────────────────
    const [statusCounts, typeCounts, priorityCounts] = await Promise.all([
      prisma.workOrder.groupBy({ by: ['status'],   _count: true }),
      prisma.workOrder.groupBy({ by: ['type'],     _count: true }),
      prisma.workOrder.groupBy({ by: ['priority'], _count: true }),
    ])

    // ── Completion rate by month ──────────────────────────────────────────────
    const completionRate = monthBuckets.map(b => {
      const created   = wos.filter(w => w.createdAt >= b.start && w.createdAt <= b.end)
      const completed = created.filter(w => w.status === 'COMPLETED').length
      return {
        month: b.label,
        rate:  created.length > 0 ? Math.round((completed / created.length) * 100) : 0,
        total: created.length,
      }
    })

    // ── Top assets by WO count + total cost ──────────────────────────────────
    const assetMap: Record<string, { name: string; code: string | null; count: number; cost: number; hours: number }> = {}
    wos.forEach(w => {
      if (!w.assetId || !w.asset) return
      if (!assetMap[w.assetId]) {
        assetMap[w.assetId] = { name: w.asset.name, code: w.asset.assetCode, count: 0, cost: 0, hours: 0 }
      }
      assetMap[w.assetId].count++
      assetMap[w.assetId].cost  += (w.laborCost ?? 0) + (w.partsCost ?? 0)
      assetMap[w.assetId].hours += (w.laborHours ?? 0)
    })
    const topAssets = Object.entries(assetMap)
      .map(([id, v]) => ({ id, ...v, cost: Math.round(v.cost) }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8)

    // ── PM compliance ─────────────────────────────────────────────────────────
    const [totalPM, overduePM] = await Promise.all([
      prisma.maintenanceSchedule.count({ where: { isActive: true } }),
      prisma.maintenanceSchedule.count({ where: { isActive: true, nextDueDate: { lt: now } } }),
    ])
    const pmCompliance = totalPM > 0
      ? Math.round(((totalPM - overduePM) / totalPM) * 100)
      : 100

    // ── Overdue WOs ───────────────────────────────────────────────────────────
    const overdueWOs = await prisma.workOrder.findMany({
      where: { status: { in: ['OPEN','IN_PROGRESS'] }, dueDate: { lt: now } },
      include: {
        asset:      { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    })

    // ── Summary KPIs ──────────────────────────────────────────────────────────
    const allCompleted = wos.filter(w => w.status === 'COMPLETED')
    const totalLaborCost  = allCompleted.reduce((s, w) => s + (w.laborCost ?? 0), 0)
    const totalPartsCost  = allCompleted.reduce((s, w) => s + (w.partsCost ?? 0), 0)
    const totalLaborHours = allCompleted.reduce((s, w) => s + (w.laborHours ?? 0), 0)
    const avgCostPerWO    = allCompleted.length > 0
      ? Math.round((totalLaborCost + totalPartsCost) / allCompleted.length)
      : 0

    // ── Low stock parts ───────────────────────────────────────────────────────
    const lowStockParts: any[] = []

    return NextResponse.json({
      kpis: {
        totalWOs:       wos.length,
        completedWOs:   allCompleted.length,
        overdueCount:   overdueWOs.length,
        pmCompliance,
        totalCost:      Math.round(totalLaborCost + totalPartsCost),
        totalLaborCost: Math.round(totalLaborCost),
        totalPartsCost: Math.round(totalPartsCost),
        totalLaborHours: Math.round(totalLaborHours * 10) / 10,
        avgCostPerWO,
      },
      woByMonth,
      costByMonth,
      completionRate,
      statusCounts:   statusCounts.map(s => ({ status: s.status, count: s._count })),
      typeCounts:     typeCounts.map(t => ({ type: t.type, count: t._count })),
      priorityCounts: priorityCounts.map(p => ({ priority: p.priority, count: p._count })),
      topAssets,
      overdueWOs: overdueWOs.map(w => ({
        id: w.id, woNumber: w.woNumber, title: w.title, status: w.status,
        dueDate: w.dueDate, assetName: w.asset?.name ?? null,
        assignedTo: w.assignedTo?.name ?? null,
        daysOverdue: w.dueDate
          ? Math.ceil((now.getTime() - new Date(w.dueDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      })),
      lowStockParts: [],
      months,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
