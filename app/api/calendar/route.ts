import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { buildLocationFilter, buildWOVisibilityFilter } from '@/lib/access-control'
import { dateOnlyToUtcMidnight, endOfUtcDay } from '@/lib/date-format'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const visibilityFilter = await buildWOVisibilityFilter(user)
  const pmFilter = await buildLocationFilter(user)

  const { searchParams } = new URL(req.url)

  let start: Date
  let end: Date

  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  if (startDateParam && endDateParam) {
    start = dateOnlyToUtcMidnight(startDateParam) ?? new Date()
    end = endOfUtcDay(endDateParam)
  } else {
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
    const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
    start = new Date(Date.UTC(year, month - 1, 1))
    end = new Date(Date.UTC(year, month, 1) - 1)
  }

  const [workOrders, pmSchedules] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        AND: visibilityFilter ? [visibilityFilter] : [],
        OR: [
          { dueDate:     { gte: start, lte: end } },
          { startedAt:   { gte: start, lte: end } },
          { completedAt: { gte: start, lte: end } },
        ],
      },
      select: {
        id: true, woNumber: true, title: true, status: true, priority: true, type: true,
        dueDate: true, dueTime: true, startTime: true, startedAt: true, completedAt: true, createdAt: true,
        asset:      { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { ...(pmFilter ?? {}), isActive: true, nextDueDate: { gte: start, lte: end } },
      select: {
        id: true,
        title: true,
        nextDueDate: true,
        asset: { select: { name: true } },
        location: { select: { name: true } },
      },
    }),
  ])

  const events = [
    ...workOrders.map((wo: any) => ({
      id:       wo.id,
      type:     'wo' as const,
      title:    wo.title,
      subtitle: wo.asset?.name ?? '',
      date:     (wo.dueDate ?? wo.completedAt ?? wo.startedAt)!,
      status:   wo.status,
      priority: wo.priority,
      woType:   wo.type,
      woNumber: wo.woNumber,
      assignee: wo.assignedTo?.name ?? null,
      dueDate:  wo.dueDate,
      dueTime:  wo.dueTime ?? null,
      startTime: wo.startTime ?? null,
      href:     `/work-orders/${wo.id}`,
    })),
    ...pmSchedules.map((pm: any) => ({
      id:       pm.id,
      type:     'pm' as const,
      title:    pm.title,
      subtitle: pm.asset?.name ?? pm.location?.name ?? '',
      date:     pm.nextDueDate,
      status:   'SCHEDULED',
      priority: 'MEDIUM',
      woType:   'PREVENTIVE',
      woNumber: null,
      assignee: null,
      dueDate:  pm.nextDueDate,
      dueTime:  null,
      startTime: null,
      href:     `/preventive-maintenance/${pm.id}`,
    })),
  ]

  return NextResponse.json({ events, start: start.toISOString(), end: end.toISOString() })
}
