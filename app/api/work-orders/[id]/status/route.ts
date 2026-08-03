import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { evaluateRules } from '@/lib/automation-engine'
import { 
  canCompleteWorkOrder, 
  getCompletionType, 
  isValidWOStatusTransition,
  canViewWorkOrder 
} from '@/lib/access-control'
import { updateWorkOrderLinkedAssetMetrics } from '@/lib/metrics'
import { notificationEmitter } from '@/lib/events'
import { z } from 'zod'

const statusSchema = z.object({
  status:      z.enum(['OPEN','IN_PROGRESS','ON_HOLD','PENDING_APPROVAL','COMPLETED','CLOSED','CANCELLED']),
  notes:       z.string().optional(),
  laborHours:  z.number().optional(),
  laborCost:   z.number().optional(),
  startedAt:   z.string().optional(),
  completedAt: z.string().optional(),
  requestedCompletionTime:  z.string().optional(),
  requestedCompletionNotes: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const parsed = statusSchema.parse(body)
    let { status, notes, laborHours, laborCost, startedAt, completedAt,
          requestedCompletionTime, requestedCompletionNotes } = parsed

    // Load current WO
    const wo = await prisma.workOrder.findUnique({ 
      where: { id },
      include: { domain: true }
    })
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ===== ACCESS CONTROL =====
    const viewAccess = await canViewWorkOrder(user, id)
    if (!viewAccess.allowed) {
      return NextResponse.json({ error: viewAccess.reason }, { status: 403 })
    }

    const isAdminOrManager = user.role === 'ADMIN' || user.role === 'MANAGER'

    // If completing, verify user has permission to complete
    if (status === 'COMPLETED') {
      const completionAccess = await canCompleteWorkOrder(user, id)
      if (!completionAccess.allowed) {
        return NextResponse.json({ error: completionAccess.reason }, { status: 403 })
      }
    }

    // ===== TWO-STEP COMPLETION =====
    // Technicians go through PENDING_APPROVAL; admins/managers can go straight to COMPLETED
    if (status === 'COMPLETED' && wo.status === 'IN_PROGRESS' && !isAdminOrManager) {
      // Tech is requesting completion — redirect to PENDING_APPROVAL
      status = 'PENDING_APPROVAL'
    }

    // Validate transition
    if (!isValidWOStatusTransition(wo.status, status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${wo.status} to ${status}` },
        { status: 422 }
      )
    }

    // Required subtasks must be complete before submission/final completion.
    // Optional subtasks do not block completion.
    const hasIncompleteRequired = async () => {
      const count = await prisma.subtask.count({
        where: { workOrderId: id, status: { not: 'COMPLETED' }, required: true },
      })
      return count
    }

    // If submitting for approval (PENDING_APPROVAL), check incomplete required subtasks
    if (status === 'PENDING_APPROVAL') {
      const incomplete = await hasIncompleteRequired()
      if (incomplete > 0) {
        return NextResponse.json(
          { error: `Cannot submit: ${incomplete} required subtask(s) still incomplete` },
          { status: 422 }
        )
      }
    }

    // If completing (direct or via approval), check incomplete required subtasks
    if (status === 'COMPLETED') {
      const incomplete = await hasIncompleteRequired()
      if (incomplete > 0) {
        return NextResponse.json(
          { error: `Cannot complete: ${incomplete} required subtask(s) still incomplete` },
          { status: 422 }
        )
      }
    }

    // ===== BUILD UPDATE DATA =====
    const updateData: Record<string, unknown> = { status }

    // Reopen: COMPLETED → OPEN — clear completion/timestamp fields, preserve history
    if (status === 'OPEN' && wo.status === 'COMPLETED') {
      if (!isAdminOrManager) {
        return NextResponse.json({ error: 'Only admins and managers can reopen work orders' }, { status: 403 })
      }
      updateData.completedAt = null
      updateData.completedById = null
      updateData.completionType = 'ASSIGNED'
      updateData.startedAt = null
      if (notes) updateData.notes = notes
    }

    // Unlock: CLOSED → COMPLETED — Admin only, reason required
    if (status === 'COMPLETED' && wo.status === 'CLOSED') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only admins can unlock closed work orders' }, { status: 403 })
      }
      if (!notes || !notes.trim()) {
        return NextResponse.json({ error: 'Unlock reason is required' }, { status: 400 })
      }
      updateData.closedAt = null
      updateData.notes = notes
    }

    if (status === 'IN_PROGRESS' && !wo.startedAt) {
      updateData.startedAt = startedAt ? new Date(startedAt) : new Date()
    }
    if (status === 'IN_PROGRESS' && !wo.respondedAt) updateData.respondedAt = new Date()
    
    // Tech submitting for approval
    if (status === 'PENDING_APPROVAL') {
      updateData.requestedCompletionTime = requestedCompletionTime
        ? new Date(requestedCompletionTime)
        : new Date()
      if (requestedCompletionNotes) {
        updateData.requestedCompletionNotes = requestedCompletionNotes
      }
      if (notes) updateData.notes = notes
      if (laborHours) updateData.laborHours = laborHours
      if (laborCost) updateData.laborCost = laborCost
    }
    
    // Final completion (admin/manager approving)
    if (status === 'COMPLETED') {
      // Use admin-supplied time, or fall back to tech's requested time, or server time
      updateData.completedAt = completedAt
        ? new Date(completedAt)
        : wo.requestedCompletionTime
          ? wo.requestedCompletionTime
          : new Date()
      updateData.completedById = user.userId
      
      const completionAccess = await canCompleteWorkOrder(user, id)
      updateData.completionType = getCompletionType(user, completionAccess.isOverride || false)
      
      if (startedAt) updateData.startedAt = new Date(startedAt)
      if (notes) updateData.notes = notes
      if (laborHours) updateData.laborHours = laborHours
      if (laborCost) updateData.laborCost = laborCost
    }

    // Rejection: PENDING_APPROVAL → IN_PROGRESS
    if (status === 'IN_PROGRESS' && wo.status === 'PENDING_APPROVAL') {
      // Clear the requested completion time on rejection
      updateData.requestedCompletionTime = null
      updateData.requestedCompletionNotes = null
      if (notes) updateData.notes = notes
    }

    // Close: COMPLETED → CLOSED (manager/admin only)
    if (status === 'CLOSED') {
      if (!isAdminOrManager) {
        return NextResponse.json({ error: 'Only admins and managers can close work orders' }, { status: 403 })
      }
      updateData.closedAt = new Date()
      if (notes) updateData.notes = notes
    }

    // Non-completion transitions
    if (status !== 'PENDING_APPROVAL' && status !== 'COMPLETED') {
      if (notes) updateData.notes = notes
      if (laborHours) updateData.laborHours = laborHours
      if (laborCost) updateData.laborCost = laborCost
    }

    const updated = await prisma.workOrder.update({ where: { id }, data: updateData })

    // Create a status history record
    await prisma.workOrderStatusHistory.create({
      data: {
        workOrderId:   id,
        status:        updated.status,
        changedById:   user.userId,
        changedByName: user.name,
        notes:         wo.status === 'CLOSED' && updated.status === 'COMPLETED'
          ? `Admin unlocked: ${notes}`
          : notes || `Status transitioned from ${wo.status} to ${updated.status}`,
      }
    })

    // Notify the activity feed (SSE) that a status change happened
    notificationEmitter.emit(`activity:${id}`)

    await writeAudit({
      action: wo.status === 'CLOSED' && updated.status === 'COMPLETED' ? 'UPDATE' : 'STATUS_CHANGE',
      entity: 'WorkOrder',
      entityId: updated.id,
      entityName: updated.title,
      changes: {
        status: { before: wo.status, after: updated.status },
        ...(wo.status === 'CLOSED' && updated.status === 'COMPLETED' ? { unlockReason: { before: null, after: notes } } : {})
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    // ===== REPAIR SESSIONS =====
    // Create a new session when work starts
    if (status === 'IN_PROGRESS' && !wo.startedAt) {
      const existingSessions = await prisma.repairSession.count({ where: { workOrderId: id } })
      const sessionStartedAt = startedAt ? new Date(startedAt) : new Date()
      await prisma.repairSession.create({
        data: {
          workOrderId: id,
          sessionNo: existingSessions + 1,
          startedAt: sessionStartedAt,
          startedById: user.userId,
        },
      })
    }

    // Complete the current session when work finishes
    if (status === 'COMPLETED') {
      const currentSession = await prisma.repairSession.findFirst({
        where: { workOrderId: id, completedAt: null },
        orderBy: { sessionNo: 'desc' },
      })
      if (currentSession) {
        const sessionCompletedAt = updateData.completedAt instanceof Date
          ? updateData.completedAt
          : new Date()
        const durationMinutes = Math.floor(
          (sessionCompletedAt.getTime() - currentSession.startedAt.getTime()) / (1000 * 60)
        )
        await prisma.repairSession.update({
          where: { id: currentSession.id },
          data: {
            completedAt: sessionCompletedAt,
            completedById: user.userId,
            durationMinutes,
          },
        })
      }
    }
    
    // ===== UPDATE ASSET METRICS =====
    if (status === 'COMPLETED') {
      try {
        await updateWorkOrderLinkedAssetMetrics(id)
      } catch (err) {
        console.error('Failed to update asset metrics:', err)
      }
    }

    // ===== FLOATING INTERVAL RESCHEDULE =====
    if (status === 'COMPLETED') {
      try {
        const { handleWOCompletion } = await import('@/lib/pm-generation')
        await handleWOCompletion(id)
      } catch (err) {
        console.error('Failed to handle floating interval reschedule:', err)
      }
    }
    
    // ===== UPDATE ASSET STATUS =====
    if (wo.assetId) {
      if (status === 'IN_PROGRESS') {
        await prisma.asset.update({
          where: { id: wo.assetId },
          data: { status: 'UNDER_MAINTENANCE' }
        })
      } else if (status === 'COMPLETED' || status === 'CLOSED' || status === 'CANCELLED') {
        await prisma.asset.update({
          where: { id: wo.assetId },
          data: { status: 'ACTIVE' }
        })
      }
    }
    
    // Send notification to creator when completed
    if (status === 'COMPLETED' && wo.createdById) {
      await createNotification({
        userId: wo.createdById,
        title: `WO ${wo.woNumber} Completed`,
        message: wo.title,
        type: 'WORK_ORDER_COMPLETED',
        entityId: updated.id,
        href: `/work-orders/${updated.id}`
      })
    }

    // Notify managers when tech submits for approval
    if (status === 'PENDING_APPROVAL' && wo.createdById) {
      await createNotification({
        userId: wo.createdById,
        title: `WO ${wo.woNumber} Needs Approval`,
        message: `${user.name} submitted completion for review`,
        type: 'WORK_ORDER_COMPLETED',
        entityId: updated.id,
        href: `/work-orders/${updated.id}`
      })
    }

    // Notify when reopened
    if (status === 'OPEN' && wo.status === 'COMPLETED' && wo.createdById) {
      await createNotification({
        userId: wo.createdById,
        title: `WO ${wo.woNumber} Reopened`,
        message: `${user.name} reopened this work order`,
        type: 'WORK_ORDER_COMPLETED',
        entityId: updated.id,
        href: `/work-orders/${updated.id}`
      })
    }

    // Notify when closed
    if (status === 'CLOSED' && wo.createdById) {
      await createNotification({
        userId: wo.createdById,
        title: `WO ${wo.woNumber} Closed`,
        message: `${user.name} closed this work order`,
        type: 'WORK_ORDER_COMPLETED',
        entityId: updated.id,
        href: `/work-orders/${updated.id}`
      })
    }

    // Recalculate asset metrics on reopen (WO drops out of completed set)
    if (status === 'OPEN' && wo.status === 'COMPLETED') {
      try {
        await updateWorkOrderLinkedAssetMetrics(id)
      } catch (err) {
        console.error('Failed to update asset metrics on reopen:', err)
      }
    }

    // Run automation rules for WO status changes
    try {
      const triggerMap: Record<string, string> = {
        COMPLETED: 'WO_COMPLETED',
        CANCELLED: 'WO_CANCELLED',
      }
      const triggerType = triggerMap[updated.status]
      if (triggerType) {
        const fullWO = await prisma.workOrder.findUnique({
          where: { id },
          include: {
            asset: {
              include: { location: true, category: true },
            },
          },
        })
        await evaluateRules(triggerType, { triggerType, workOrder: fullWO })
      }
    } catch (err) {
      console.error('Failed to run automation rules:', err)
    }
    
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
