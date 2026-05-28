import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59)

  const [workOrders, pmSchedules] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        OR: [
          { dueDate:     { gte: start, lte: end } },
          { startedAt:   { gte: start, lte: end } },
          { completedAt: { gte: start, lte: end } },
        ],
      },
      select: {
        id: true, woNumber: true, title: true, status: true, priority: true, type: true,
        dueDate: true, startedAt: true, completedAt: true,
        asset:      { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { isActive: true, nextDueDate: { gte: start, lte: end } },
      select: {
        id: true,
        title: true,
        nextDueDate: true,
        asset: { select: { name: true } },
        location: { select: { name: true } },
      },
    }),
  ])

  // Shape into calendar events
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
      href:     `/preventive-maintenance/${pm.id}`,
    })),
  ]

  return NextResponse.json({ events, year, month })
}