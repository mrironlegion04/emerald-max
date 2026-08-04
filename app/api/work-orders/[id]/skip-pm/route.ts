import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { createNotification } from '@/lib/notifications'
import { canAccessTeamScope, hasScopeActionFlag } from '@/lib/access-control'
import { z } from 'zod'

const skipSchema = z.object({
  notes: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { notes } = skipSchema.parse(body)

    // Load WO
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        maintenanceSchedule: {
          select: {
            id: true,
            frequency: true,
            interval: true,
            nextDueDate: true,
            scheduleBehavior: true,
          },
        },
      },
    })

    if (!wo) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    // Only PM-generated WOs can be skipped
    if (!wo.maintenanceScheduleId) {
      return NextResponse.json({ error: 'Only PM-generated work orders can be skipped' }, { status: 400 })
    }

    // Only OPEN or IN_PROGRESS WOs can be skipped
    if (!['OPEN', 'IN_PROGRESS'].includes(wo.status)) {
      return NextResponse.json({ error: 'Work order cannot be skipped in current status' }, { status: 400 })
    }

    // Check access: admin, scoped manager, or assigned technician
    if (user.role === 'MANAGER') {
      const teamScopeOk = await canAccessTeamScope(user, wo.teamId)
      const closeFlagOk = await hasScopeActionFlag(user, 'canCloseWO')
      if (!teamScopeOk || !closeFlagOk) {
        return NextResponse.json({ error: 'You do not have access to skip this work order' }, { status: 403 })
      }
    } else if (user.role !== 'ADMIN') {
      const isAssignedTech = wo.assignedToId === user.userId
      if (!isAssignedTech) {
        return NextResponse.json({ error: 'Only admins, managers, or assigned technicians can skip' }, { status: 403 })
      }
    }

    // Use transaction to update both WO and schedule atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark WO as CANCELLED with skip note
      const updated = await tx.workOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: notes ? `Skipped: ${notes}` : 'Skipped PM cycle',
        },
      })

      // 2. Create status history
      await tx.workOrderStatusHistory.create({
        data: {
          workOrderId: id,
          status: 'CANCELLED',
          changedById: user.userId,
          changedByName: user.name,
          notes: `Skipped by ${user.name}${notes ? `: ${notes}` : ''}`,
        },
      })

      // 3. Advance the PM schedule to next due date
      const schedule = wo.maintenanceSchedule!
      const { advanceDate } = await import('@/lib/pm-generation')
      const nextDue = advanceDate(
        new Date(schedule.nextDueDate),
        schedule.frequency,
        schedule.interval
      )

      await tx.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: {
          nextDueDate: nextDue,
        },
      })

      return { updated, nextDue }
    })

    // Notify WO creator
    if (wo.createdById && wo.createdById !== user.userId) {
      await createNotification({
        userId: wo.createdById,
        title: `WO ${wo.woNumber} Skipped`,
        message: `${user.name} skipped this PM cycle${notes ? `: ${notes}` : ''}`,
        type: 'WORK_ORDER_COMPLETED',
        entityId: id,
        href: `/work-orders/${id}`,
      })
    }

    return NextResponse.json({
      message: 'Work order skipped and PM schedule advanced',
      nextDueDate: result.nextDue,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to skip work order' }, { status: 500 })
  }
}
