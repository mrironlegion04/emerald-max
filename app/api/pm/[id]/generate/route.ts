import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { generateWOsForSchedule } from '@/lib/pm-generation'
import { writeAudit } from '@/lib/audit'
import { prisma } from '@/lib/db'
import { buildLocationFilter } from '@/lib/access-control'

export async function POST(
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

    const result = await generateWOsForSchedule(id, { userId: user.userId })

    if (result.errors.length > 0 && result.workOrderIds.length === 0) {
      return NextResponse.json({ error: result.errors[0] }, { status: 422 })
    }

    // Audit log
    await writeAudit({
      action: 'GENERATE',
      entity: 'Work Order',
      entityId: result.workOrderIds[0] ?? 'batch',
      entityName: `Generated ${result.woNumbers.join(', ')}`,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(
      {
        woNumber: result.woNumbers[0],
        woNumbers: result.woNumbers,
        created: result.workOrderIds.length,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to generate work order' },
      { status: 500 },
    )
  }
}
