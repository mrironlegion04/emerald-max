import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

interface ScheduleQuery {
  startDate: string // ISO date
  endDate: string   // ISO date
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate query params required' },
        { status: 400 }
      )
    }

    // Fetch all technicians/users who work on WOs
    const technicians = await prisma.user.findMany({
      where: { role: { in: ['TECHNICIAN', 'MANAGER'] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    })

    // Fetch work orders in the date range (assigned + unassigned)
    const workOrders = await prisma.workOrder.findMany({
      where: {
        OR: [
          // Due date within range
          {
            dueDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
          // No due date but created within range
          {
            dueDate: null,
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          },
        ],
      },
      include: {
        asset: { select: { id: true, name: true, assetCode: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    // Split into assigned and unassigned
    const assigned = workOrders.filter(wo => wo.assignedToId)
    const unassigned = workOrders.filter(wo => !wo.assignedToId)

    return NextResponse.json({
      technicians,
      assigned,
      unassigned,
      dateRange: { start: startDate, end: endDate },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}
