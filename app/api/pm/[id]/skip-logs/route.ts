import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { buildLocationFilter } from '@/lib/access-control'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:edit'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      select: { locationId: true },
    })
    if (!schedule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const locationFilter = await buildLocationFilter(user)
    if (locationFilter && (!schedule.locationId || !(locationFilter.locationId as { in: string[] }).in.includes(schedule.locationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const skipLogs = await prisma.pmSkipLog.findMany({
      where: { scheduleId: id },
      orderBy: { skippedAt: 'desc' },
      take: 50,
      include: {
        asset: { select: { id: true, name: true } },
        blockingWo: { select: { id: true, woNumber: true } },
      },
    })

    return NextResponse.json({ skipLogs })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to fetch skip logs' },
      { status: 500 },
    )
  }
}
