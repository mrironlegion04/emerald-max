import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { canCompleteSubtask, canEditWorkOrder, canCompleteWorkOrder, canViewWorkOrder, getCompletionType, isAdmin, isManagerOrAbove, canAssignUsers, canAssignTeams } from '@/lib/access-control'
import { dateOnlyToUtcMidnight } from '@/lib/date-format'
import { z } from 'zod'

const updateSubtaskSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  dueDate: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  assignedTeamId: z.string().nullable().optional(),
  required: z.boolean().optional(),
  remarks: z.string().nullable().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const subtask = await prisma.subtask.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedTeam: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        workOrder: { select: { id: true, woNumber: true, title: true } },
      },
    })

    if (!subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
    }

    const viewAccess = await canViewWorkOrder(user, subtask.workOrderId)
    if (!viewAccess.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(subtask)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch subtask' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const data = updateSubtaskSchema.parse(body)

    // Verify subtask exists
    const existingSubtask = await prisma.subtask.findUnique({
      where: { id },
    })
    if (!existingSubtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
    }

    // Users who can edit the WO or who are assigned to it (tech flow) may update subtasks
    const editAccess = await canEditWorkOrder(user, existingSubtask.workOrderId)
    const completeAccess = await canCompleteWorkOrder(user, existingSubtask.workOrderId)
    if (!editAccess.allowed && !completeAccess.allowed) {
      return NextResponse.json({ error: editAccess.reason ?? 'Forbidden' }, { status: 403 })
    }

    // ===== ACCESS CONTROL FOR COMPLETION =====
    // If completing, verify user has permission
    if (data.status === 'COMPLETED' && existingSubtask.status !== 'COMPLETED') {
      const completionAccess = await canCompleteSubtask(user, id)
      if (!completionAccess.allowed) {
        return NextResponse.json({ error: completionAccess.reason }, { status: 403 })
      }
    }

    // Verify assigned user exists if provided
    if (data.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: data.assignedToId },
      })
      if (!assignedUser) {
        return NextResponse.json({ error: 'Assigned user not found' }, { status: 404 })
      }
    }

    // Verify assigned team exists if provided
    if (data.assignedTeamId !== undefined && data.assignedTeamId) {
      const assignedTeam = await prisma.team.findUnique({
        where: { id: data.assignedTeamId },
      })
      if (!assignedTeam) {
        return NextResponse.json({ error: 'Assigned team not found' }, { status: 404 })
      }
    }

    // ===== PERMISSION CHECKS FOR REASSIGNMENT =====
    // Only admins/managers can reassign
    if ((data.assignedToId || data.assignedTeamId) && !isManagerOrAbove(user)) {
      return NextResponse.json(
        { error: 'Only admin/manager can reassign subtask' },
        { status: 403 }
      )
    }

    // Reassignees must be within the user's write scope
    const inScope =
      (data.assignedToId !== undefined ? await canAssignUsers(user, [data.assignedToId]) : true) &&
      (data.assignedTeamId !== undefined ? await canAssignTeams(user, [data.assignedTeamId]) : true)
    if (!inScope) {
      return NextResponse.json(
        { error: 'You do not have access to the selected assignee' },
        { status: 403 }
      )
    }

    // Determine if completing the subtask
    const isCompleting = data.status === 'COMPLETED' && existingSubtask.status !== 'COMPLETED'

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) updateData.status = data.status
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.dueDate !== undefined) {
      updateData.dueDate = dateOnlyToUtcMidnight(data.dueDate)
    }
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId
    if (data.assignedTeamId !== undefined) {
      updateData.assignedTeamId = data.assignedTeamId
    }
    if (data.required !== undefined) updateData.required = data.required
    if (data.remarks !== undefined) updateData.remarks = data.remarks

    // Track completion
    if (isCompleting) {
      updateData.completedAt = new Date()
      updateData.completedById = user.userId
      
      // Determine completion type (assigned vs override)
      const completionAccess = await canCompleteSubtask(user, id)
      updateData.completionType = getCompletionType(user, completionAccess.isOverride || false)
    }

    const subtask = await prisma.subtask.update({
      where: { id },
      data: updateData,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedTeam: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        workOrder: { select: { id: true, woNumber: true, title: true } },
      },
    })

    // Audit log
    await writeAudit({
      action: 'UPDATE',
      entity: 'Subtask',
      entityId: subtask.id,
      entityName: subtask.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(subtask)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update subtask' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Verify subtask exists
    const subtask = await prisma.subtask.findUnique({
      where: { id },
    })
    if (!subtask) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 })
    }

    // Users who can edit the WO or who are assigned to it (tech flow) may delete subtasks
    const editAccess = await canEditWorkOrder(user, subtask.workOrderId)
    const completeAccess = await canCompleteWorkOrder(user, subtask.workOrderId)
    if (!editAccess.allowed && !completeAccess.allowed) {
      return NextResponse.json({ error: editAccess.reason ?? 'Forbidden' }, { status: 403 })
    }

    // Delete the subtask
    await prisma.subtask.delete({
      where: { id },
    })

    // Audit log
    await writeAudit({
      action: 'DELETE',
      entity: 'Subtask',
      entityId: subtask.id,
      entityName: subtask.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete subtask' }, { status: 500 })
  }
}
