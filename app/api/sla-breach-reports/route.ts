import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { subDays, format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const dateFrom = request.nextUrl.searchParams.get('dateFrom')
    const dateTo = request.nextUrl.searchParams.get('dateTo')
    const exportCsv = request.nextUrl.searchParams.get('export')

    let startDate: Date
    let endDate: Date

    if (dateFrom && dateTo) {
      startDate = new Date(dateFrom)
      endDate = new Date(dateTo)
    } else {
      // Default: last 30 days
      endDate = new Date()
      startDate = subDays(endDate, 30)
    }

    // Get all breaches in the date range
    const breaches = await prisma.sLABreachHistory.findMany({
      where: {
        breachedAt: { gte: startDate, lte: endDate },
      },
      include: {
        workOrder: {
          include: {
            asset: { include: { category: true } },
            assignedTo: {
              include: {
                teamMembers: {
                  include: {
                    team: true
                  }
                }
              }
            },
            createdBy: true,
          },
        },
      },
      orderBy: { breachedAt: 'desc' },
    })

    // Get all WOs in range for total count
    const totalWOs = await prisma.workOrder.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      }
    })

    // Calculate metrics
    const totalBreaches = breaches.length
    const complianceRate = totalWOs > 0 ? Math.round(((totalWOs - totalBreaches) / totalWOs) * 100) : 100

    const breachesByType = {
      RESPONSE: breaches.filter((b) => b.breachType === 'RESPONSE').length,
      RESOLUTION: breaches.filter((b) => b.breachType === 'RESOLUTION').length,
    }

    // Breaches by priority
    const breachesByPriority = breaches.reduce(
      (acc, breach) => {
        const priority = breach.workOrder?.priority || 'UNKNOWN'
        acc[priority] = (acc[priority] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Breaches by status
    const breachesByStatus = breaches.reduce(
      (acc, breach) => {
        const status = breach.workOrder?.status || 'UNKNOWN'
        acc[status] = (acc[status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // 1. Correct startDate for "All Time" to avoid 1970 overflow
    if (startDate.getTime() === 0) {
      const firstWO = await prisma.workOrder.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      })
      if (firstWO) {
        startDate = firstWO.createdAt
      } else {
        startDate = subDays(endDate, 30)
      }
    }

    // 2. Adaptive trend grouping
    const totalDays = Math.max(1, differenceInDays(endDate, startDate))
    let intervalDays = 7 // Default: Weekly
    let dateFormat: (d: Date) => string = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

    if (totalDays > 180) {
      intervalDays = 30 // Monthly for > 6 months
      dateFormat = (d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    } else if (totalDays <= 14) {
      intervalDays = 1 // Daily for <= 2 weeks
    }

    const weeklyTrend: { week: string; breaches: number; total: number }[] = []
    let currentTrendDate = new Date(startDate)
    
    while (currentTrendDate <= endDate) {
      const periodStart = new Date(currentTrendDate)
      const periodEnd = new Date(currentTrendDate)
      periodEnd.setDate(periodEnd.getDate() + intervalDays)

      const label = dateFormat(periodStart)
      
      const breachCount = breaches.filter(b => {
        const bDate = new Date(b.breachedAt)
        return bDate >= periodStart && bDate < periodEnd
      }).length

      const totalCount = await prisma.workOrder.count({
        where: {
          createdAt: { gte: periodStart, lt: periodEnd }
        }
      })

      weeklyTrend.push({ week: label, breaches: breachCount, total: totalCount })
      currentTrendDate.setDate(currentTrendDate.getDate() + intervalDays)
      
      // Safety cap at 60 points to keep charts performant
      if (weeklyTrend.length >= 60) break
    }

    // Top assets with breaches
    const assetBreaches = breaches.reduce(
      (acc, breach) => {
        if (!breach.workOrder?.asset) return acc
        const assetName = breach.workOrder.asset.name
        acc[assetName] = (acc[assetName] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    const topAssets = Object.entries(assetBreaches)
      .map(([name, count]) => ({ assetName: name, breaches: count }))
      .sort((a, b) => b.breaches - a.breaches)

    // Get comparison metrics for previous period
    const diffDays = Math.max(1, differenceInDays(endDate, startDate))
    const prevStartDate = subDays(startDate, diffDays)
    const prevEndDate = startDate

    const prevTotalWOs = await prisma.workOrder.count({
      where: { createdAt: { gte: prevStartDate, lte: prevEndDate } }
    })
    const prevBreachCount = await prisma.sLABreachHistory.count({
      where: { breachedAt: { gte: prevStartDate, lte: prevEndDate } }
    })
    const prevComplianceRate = prevTotalWOs > 0 ? Math.round(((prevTotalWOs - prevBreachCount) / prevTotalWOs) * 100) : 100

    // CSV Export
    if (exportCsv === 'true') {
      const csv = [
        ['WO Number', 'Title', 'Asset', 'Priority', 'Status', 'Breach Type', 'Target Mins', 'Actual Mins', 'Delay Mins', 'Created', 'Breached'].join(','),
        ...breaches.map(b => [
          b.workOrder?.woNumber || 'N/A',
          b.workOrder?.title || 'N/A',
          b.workOrder?.asset?.name || 'N/A',
          b.workOrder?.priority || 'N/A',
          b.workOrder?.status || 'N/A',
          b.breachType,
          b.targetMinutes,
          b.actualMinutes,
          Math.max(0, b.actualMinutes - b.targetMinutes),
          new Date(b.workOrder?.createdAt || '').toLocaleDateString(),
          new Date(b.breachedAt).toLocaleDateString(),
        ].join(','))
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="sla-breaches.csv"',
        },
      })
    }

    return NextResponse.json({
      summary: {
        total: totalWOs,
        prevTotal: prevTotalWOs,
        breaches: totalBreaches,
        prevBreaches: prevBreachCount,
        complianceRate,
        prevComplianceRate,
        responseBreaches: breachesByType.RESPONSE,
        resolutionBreaches: breachesByType.RESOLUTION,
      },
      breachesByPriority,
      breachesByStatus,
      topAssets,
      weeklyTrend,
      recentBreaches: breaches.slice(0, 20).map(b => ({
        id: b.id,
        workOrderId: b.workOrderId,
        woNumber: b.workOrder?.woNumber || 'N/A',
        title: b.workOrder?.title || 'N/A',
        priority: b.workOrder?.priority || 'UNKNOWN',
        status: b.workOrder?.status || 'UNKNOWN',
        assetName: b.workOrder?.asset?.name || 'N/A',
        createdAt: b.breachedAt.toISOString(),
        breachType: b.breachType,
        targetMinutes: b.targetMinutes,
        actualMinutes: b.actualMinutes,
        delayMinutes: Math.max(0, b.actualMinutes - b.targetMinutes),
      })),
    })
  } catch (error) {
    console.error('SLA Breach Reports API error:', error)
    return NextResponse.json({ error: 'Failed to fetch breach data' }, { status: 500 })
  }
}
