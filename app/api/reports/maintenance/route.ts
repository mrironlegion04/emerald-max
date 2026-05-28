import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const searchParams = req.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const now = new Date()
    let from = new Date()
    let to = now

    // Parse date filters
    if (dateFrom && dateTo) {
      from = new Date(dateFrom)
      to = new Date(dateTo)
    } else {
      // Default: last 3 months
      from.setMonth(from.getMonth() - 3)
    }

    // Get all work orders in the date range
    const allWorkOrders = await prisma.workOrder.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      include: {
        asset: { select: { locationId: true } },
      },
    })

    // Get all locations
    const locations = await prisma.location.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        parentId: true,
      },
    })

    // Recursive helper to get all sub-location IDs under a location (including itself)
    function getDescendantIds(locId: string, allLocs: typeof locations): string[] {
      const ids = [locId]
      const children = allLocs.filter(l => l.parentId === locId)
      for (const child of children) {
        ids.push(...getDescendantIds(child.id, allLocs))
      }
      return ids
    }

    // Filter only top-level parent locations
    const parentLocations = locations.filter(loc => !loc.parentId)

    // Calculate aggregates across ALL work orders to be 100% accurate
    const summary = {
      total: allWorkOrders.length,
      breakdown: allWorkOrders.filter(w => w.type === 'BREAKDOWN').length,
      preventive: allWorkOrders.filter(w => w.type === 'PREVENTIVE').length,
      open: allWorkOrders.filter(w => w.status === 'OPEN').length,
      completed: allWorkOrders.filter(w => w.status === 'COMPLETED').length,
    }

    const locationsData = parentLocations.map(loc => {
      const descendantIds = getDescendantIds(loc.id, locations)
      // Filter work orders that belong to this location OR any of its descendants
      const wos = allWorkOrders.filter(wo => wo.asset?.locationId && descendantIds.includes(wo.asset.locationId))

      const byType = {
        BREAKDOWN: wos.filter(w => w.type === 'BREAKDOWN').length,
        PREVENTIVE: wos.filter(w => w.type === 'PREVENTIVE').length,
        PREDICTIVE: wos.filter(w => w.type === 'PREDICTIVE').length,
      }
      const byStatus = {
        OPEN: wos.filter(w => w.status === 'OPEN').length,
        IN_PROGRESS: wos.filter(w => w.status === 'IN_PROGRESS').length,
        ON_HOLD: wos.filter(w => w.status === 'ON_HOLD').length,
        COMPLETED: wos.filter(w => w.status === 'COMPLETED').length,
        CANCELLED: wos.filter(w => w.status === 'CANCELLED').length,
      }
      const byPriority = {
        CRITICAL: wos.filter(w => w.priority === 'CRITICAL').length,
        HIGH: wos.filter(w => w.priority === 'HIGH').length,
        MEDIUM: wos.filter(w => w.priority === 'MEDIUM').length,
        LOW: wos.filter(w => w.priority === 'LOW').length,
      }

      const total = wos.length

      return {
        id: loc.id,
        name: loc.name,
        address: loc.address ?? '',
        total,
        byType,
        byStatus,
        byPriority,
        criticalCount: byPriority.CRITICAL,
        overdueCount: 0,
      }
    })

    return NextResponse.json({
      summary,
      locations: locationsData,
    })
  } catch (error) {
    console.error('Maintenance report error:', error)
    return NextResponse.json({ error: 'Failed to fetch maintenance report' }, { status: 500 })
  }
}
