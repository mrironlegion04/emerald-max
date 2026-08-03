import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { buildLocationFilter } from '@/lib/access-control'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:create'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        tasks: { orderBy: { order: 'asc' as const } },
        assets: { select: { assetId: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const locationFilter = await buildLocationFilter(user)
    if (locationFilter && (!existing.locationId || !(locationFilter.locationId as { in: string[] }).in.includes(existing.locationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Calculate new due date = today + interval
    const now = new Date()
    const newDueDate = new Date(now)
    switch (existing.frequency) {
      case 'DAILY':
        newDueDate.setDate(newDueDate.getDate() + existing.interval)
        break
      case 'WEEKLY':
        newDueDate.setDate(newDueDate.getDate() + existing.interval * 7)
        break
      case 'MONTHLY':
        newDueDate.setMonth(newDueDate.getMonth() + existing.interval)
        break
      case 'QUARTERLY':
        newDueDate.setMonth(newDueDate.getMonth() + existing.interval * 3)
        break
      case 'YEARLY':
        newDueDate.setFullYear(newDueDate.getFullYear() + existing.interval)
        break
    }

    const newSchedule = await prisma.maintenanceSchedule.create({
      data: {
        title:               `${existing.title} (Copy)`,
        description:         existing.description,
        triggerType:         existing.triggerType,
        frequency:           existing.frequency,
        interval:            existing.interval,
        nextDueDate:         newDueDate,
        assetId:             existing.assetId,
        assets:              existing.assets.length > 0
          ? { create: existing.assets.map(a => ({ assetId: a.assetId })) }
          : (existing.assetId ? { create: [{ assetId: existing.assetId }] } : undefined),
        locationId:          existing.locationId,
        locationScope:       existing.locationScope,
        meterId:             existing.meterId,
        meterInterval:       existing.meterInterval,
        meterUnit:           existing.meterUnit,
        isActive:            true,
        createdById:         user.userId,
        scheduleBehavior:    existing.scheduleBehavior,
        schedulingHorizon:   existing.schedulingHorizon,
        nestedConfig:        existing.nestedConfig as any,
        nestedCounter:       0,
        nestedStartIndex:    existing.nestedStartIndex,
        woPriority:          existing.woPriority,
        woDescription:       existing.woDescription,
        woAssignedToId:      existing.woAssignedToId,
        woTeamId:            existing.woTeamId,
        woCategoryId:        existing.woCategoryId,
        startDateOffset:     existing.startDateOffset,
        tasks: {
          create: existing.tasks.map(t => ({
            title:        t.title,
            order:        t.order,
            assignedToId: t.assignedToId,
            required:     t.required,
          })),
        },
      },
    })

    await writeAudit({
      action: 'CREATE',
      entity: 'MaintenanceSchedule',
      entityId: newSchedule.id,
      entityName: `${newSchedule.title} (copied from ${existing.title})`,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(newSchedule, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to duplicate schedule' },
      { status: 500 },
    )
  }
}
