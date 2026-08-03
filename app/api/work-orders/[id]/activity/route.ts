import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canViewWorkOrder } from '@/lib/access-control'
import { buildActivityEvents, resolveActivityLookups } from '@/lib/work-order-activity'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const viewAccess = await canViewWorkOrder(user, id)
    if (!viewAccess.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [statusHistory, auditLogs] = await Promise.all([
      prisma.workOrderStatusHistory.findMany({
        where: { workOrderId: id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: { entity: 'Work Order', entityId: id, action: { not: 'STATUS_CHANGE' } },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const { users, teams } = await resolveActivityLookups(auditLogs, prisma)
    const events = buildActivityEvents(statusHistory, auditLogs, users, teams)

    return NextResponse.json({ events, currentUserId: user.userId })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
