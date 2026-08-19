import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { buildPmActivityEvents } from '@/lib/entity-activity'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    const auditLogs = await prisma.auditLog.findMany({
      where: { entity: 'MaintenanceSchedule', entityId: id },
      orderBy: { createdAt: 'asc' },
    })

    const events = buildPmActivityEvents(auditLogs)

    return NextResponse.json({ events })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
