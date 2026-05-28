import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    if (user.role === 'TECHNICIAN') return NextResponse.json({ error: 'Technicians cannot export data' }, { status: 403 })

    const { locationId } = await params
    const searchParams = req.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const exportCsv = searchParams.get('export') === 'true'

    const now = new Date()
    let from = new Date()
    let to = now

    if (dateFrom && dateTo) {
      from = new Date(dateFrom)
      to = new Date(dateTo)
    } else {
      from.setMonth(from.getMonth() - 3)
    }

    // Get location
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, address: true },
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Fetch all locations to get parent relations
    const allLocations = await prisma.location.findMany({
      select: { id: true, parentId: true }
    })

    // Recursive helper to get all sub-location IDs under a location (including itself)
    function getDescendantIds(locId: string, allLocs: typeof allLocations): string[] {
      const ids = [locId]
      const children = allLocs.filter(l => l.parentId === locId)
      for (const child of children) {
        ids.push(...getDescendantIds(child.id, allLocs))
      }
      return ids
    }

    const descendantIds = getDescendantIds(locationId, allLocations)

    // Get all work orders for this location and all sublocations (through assets)
    const workOrders = await prisma.workOrder.findMany({
      where: {
        asset: { locationId: { in: descendantIds } },
        createdAt: { gte: from, lte: to },
      },
      include: {
        asset: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Build CSV if requested
    if (exportCsv) {
      const headers = [
        'WO Number',
        'Title',
        'Type',
        'Priority',
        'Status',
        'Asset',
        'Assigned To',
        'Created',
        'Due Date',
        'Completed',
        'Labor Cost',
        'Parts Cost',
      ]

      const rows = workOrders.map(wo => [
        wo.woNumber,
        wo.description,
        wo.type,
        wo.priority,
        wo.status,
        wo.asset?.name || '—',
        wo.assignedTo?.name || '—',
        new Date(wo.createdAt).toLocaleDateString(),
        wo.dueDate ? new Date(wo.dueDate).toLocaleDateString() : '—',
        wo.completedAt ? new Date(wo.completedAt).toLocaleDateString() : '—',
        wo.laborCost || 0,
        wo.partsCost || 0,
      ])

      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="maintenance-report-${locationId}-${Date.now()}.csv"`,
        },
      })
    }

    // Build data for JSON response
    const typeStatusMatrix = [
      { type: 'BREAKDOWN', open: 0, inProgress: 0, onHold: 0, completed: 0, cancelled: 0, total: 0 },
      { type: 'PREVENTIVE', open: 0, inProgress: 0, onHold: 0, completed: 0, cancelled: 0, total: 0 },
      { type: 'PREDICTIVE', open: 0, inProgress: 0, onHold: 0, completed: 0, cancelled: 0, total: 0 },
    ]

    const priorityStatusMatrix = [
      { priority: 'CRITICAL', open: 0, inProgress: 0, completed: 0, total: 0 },
      { priority: 'HIGH', open: 0, inProgress: 0, completed: 0, total: 0 },
      { priority: 'MEDIUM', open: 0, inProgress: 0, completed: 0, total: 0 },
      { priority: 'LOW', open: 0, inProgress: 0, completed: 0, total: 0 },
    ]

    // Fill matrices
    workOrders.forEach(wo => {
      const typeRow = typeStatusMatrix.find(row => row.type === wo.type)
      if (typeRow) {
        typeRow.total += 1
        if (wo.status === 'OPEN') typeRow.open += 1
        else if (wo.status === 'IN_PROGRESS') typeRow.inProgress += 1
        else if (wo.status === 'ON_HOLD') typeRow.onHold += 1
        else if (wo.status === 'COMPLETED') typeRow.completed += 1
        else if (wo.status === 'CANCELLED') typeRow.cancelled += 1
      }

      const priorityRow = priorityStatusMatrix.find(row => row.priority === wo.priority)
      if (priorityRow) {
        priorityRow.total += 1
        if (wo.status === 'OPEN') priorityRow.open += 1
        else if (wo.status === 'IN_PROGRESS') priorityRow.inProgress += 1
        else if (wo.status === 'COMPLETED') priorityRow.completed += 1
      }
    })

    // Build weekly trend (last 12 weeks)
    const weeklyTrend: Record<string, { created: number; completed: number }> = {}
    const startDate = new Date(from)
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(startDate)
      weekStart.setDate(weekStart.getDate() + i * 7)
      const weekKey = weekStart.toISOString().split('T')[0]
      weeklyTrend[weekKey] = { created: 0, completed: 0 }
    }

    workOrders.forEach(wo => {
      const createdWeek = new Date(wo.createdAt)
      createdWeek.setDate(createdWeek.getDate() - createdWeek.getDay())
      const weekKey = createdWeek.toISOString().split('T')[0]
      if (weeklyTrend[weekKey]) weeklyTrend[weekKey].created += 1

      if (wo.completedAt) {
        const completedWeek = new Date(wo.completedAt)
        completedWeek.setDate(completedWeek.getDate() - completedWeek.getDay())
        const completedKey = completedWeek.toISOString().split('T')[0]
        if (weeklyTrend[completedKey]) weeklyTrend[completedKey].completed += 1
      }
    })

    const recentWOs = workOrders.slice(0, 15).map(wo => ({
      id: wo.id,
      woNumber: wo.woNumber,
      title: wo.description,
      type: wo.type,
      priority: wo.priority,
      status: wo.status,
      assetName: wo.asset?.name || '—',
      dueDate: wo.dueDate,
      createdAt: wo.createdAt,
      isOverdue: wo.dueDate && wo.dueDate < now && wo.status !== 'COMPLETED',
    }))

    const completed = workOrders.filter(wo => wo.status === 'COMPLETED').length
    const open = workOrders.filter(wo => wo.status === 'OPEN').length
    const overdue = workOrders.filter(wo => wo.dueDate && wo.dueDate < now && wo.status !== 'COMPLETED').length

    const totals = {
      total: workOrders.length,
      completed,
      open,
      overdue,
      avgResolutionHours: 0,
    }

    return NextResponse.json({
      location,
      typeStatusMatrix,
      priorityStatusMatrix,
      weeklyTrend: Object.entries(weeklyTrend).map(([week, data]) => ({ week, ...data })),
      recentWOs,
      totals,
    })
  } catch (error) {
    console.error('Maintenance detail report error:', error)
    return NextResponse.json({ error: 'Failed to fetch maintenance detail report' }, { status: 500 })
  }
}
