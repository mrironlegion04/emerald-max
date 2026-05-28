import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get all completed breakdown WOs with timing data, grouped by asset
  const wos = await prisma.workOrder.findMany({
    where: {
      status: 'COMPLETED',
      type: 'BREAKDOWN',
      assetId: { not: null },
      startedAt: { not: null },
      completedAt: { not: null },
    },
    select: {
      id: true, assetId: true, startedAt: true, completedAt: true,
      createdAt: true, laborHours: true,
      asset: { select: { id: true, name: true, assetCode: true } },
    },
    orderBy: { completedAt: 'asc' },
  })

  // Group by asset
  const assetMap: Record<string, {
    assetId: string; name: string; code: string | null
    wos: { startedAt: Date; completedAt: Date; createdAt: Date; laborHours: number | null }[]
  }> = {}

  for (const wo of wos) {
    if (!wo.assetId || !wo.asset || !wo.startedAt || !wo.completedAt) continue
    if (!assetMap[wo.assetId]) {
      assetMap[wo.assetId] = { assetId: wo.assetId, name: wo.asset.name, code: wo.asset.assetCode, wos: [] }
    }
    assetMap[wo.assetId].wos.push({
      startedAt: wo.startedAt, completedAt: wo.completedAt,
      createdAt: wo.createdAt, laborHours: wo.laborHours,
    })
  }

  const metrics = Object.values(assetMap).map(entry => {
    const { wos: woList } = entry

    // MTTR = average repair time in hours (completedAt - startedAt)
    const repairTimes = woList.map(w => (w.completedAt.getTime() - w.startedAt.getTime()) / (1000 * 60 * 60))
    const avgMTTR     = repairTimes.length > 0 ? repairTimes.reduce((a, b) => a + b, 0) / repairTimes.length : 0

    // MTBF = average time between failures in days
    let avgMTBF = 0
    if (woList.length > 1) {
      const sorted = [...woList].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      const gaps   = []
      for (let i = 1; i < sorted.length; i++) {
        gaps.push((sorted[i].createdAt.getTime() - sorted[i-1].createdAt.getTime()) / (1000 * 60 * 60 * 24))
      }
      avgMTBF = gaps.reduce((a, b) => a + b, 0) / gaps.length
    }

    const totalLaborHours = woList.reduce((s, w) => s + (w.laborHours ?? 0), 0)

    return {
      assetId:         entry.assetId,
      assetName:       entry.name,
      assetCode:       entry.code,
      failureCount:    woList.length,
      avgMTTR:         Math.round(avgMTTR * 10) / 10,   // hours, 1 decimal
      avgMTBF:         Math.round(avgMTBF * 10) / 10,   // days, 1 decimal
      totalLaborHours: Math.round(totalLaborHours * 10) / 10,
    }
  })

  // Sort by failure count descending
  metrics.sort((a, b) => b.failureCount - a.failureCount)

  // Overall fleet metrics
  const totalFailures  = metrics.reduce((s, m) => s + m.failureCount, 0)
  const fleetAvgMTTR   = metrics.length > 0 ? metrics.reduce((s, m) => s + m.avgMTTR, 0) / metrics.length : 0
  const fleetAvgMTBF   = metrics.length > 0 ? metrics.reduce((s, m) => s + m.avgMTBF, 0) / metrics.filter(m => m.avgMTBF > 0).length : 0

  return NextResponse.json({
    assets: metrics,
    summary: {
      totalAssets:   metrics.length,
      totalFailures,
      fleetAvgMTTR:  Math.round(fleetAvgMTTR * 10) / 10,
      fleetAvgMTBF:  Math.round((isNaN(fleetAvgMTBF) ? 0 : fleetAvgMTBF) * 10) / 10,
    },
  })
}