import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import { 
  canCompleteWorkOrder, 
  getCompletionType, 
  isValidWOStatusTransition,
  canViewWorkOrder 
} from '@/lib/access-control'
import { updateAssetMetrics } from '@/lib/metrics'
import { z } from 'zod'

const statusSchema = z.object({
  status:     z.enum(['OPEN','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED']),
  notes:      z.string().optional(),
  laborHours: z.number().optional(),
  laborCost:  z.number().optional(),
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
    const { status, notes, laborHours, laborCost } = statusSchema.parse(body)

    // Load current WO
    const wo = await prisma.workOrder.findUnique({ 
      where: { id },
      include: { domain: true }
    })
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ===== ACCESS CONTROL =====
    // First, verify user can view the WO
    const viewAccess = await canViewWorkOrder(user, id)
    if (!viewAccess.allowed) {
      return NextResponse.json({ error: viewAccess.reason }, { status: 403 })
    }

    // If completing, verify user has permission to complete
    if (status === 'COMPLETED') {
      const completionAccess = await canCompleteWorkOrder(user, id)
      if (!completionAccess.allowed) {
        return NextResponse.json({ error: completionAccess.reason }, { status: 403 })
      }
    }

    // Validate transition
    if (!isValidWOStatusTransition(wo.status, status)) {
      return NextResponse.json(
        { error: `Cannot transition from ${wo.status} to ${status}` },
        { status: 422 }
      )
    }

    // If completing, check for unchecked mandatory procedure steps across ALL procedures
    if (status === 'COMPLETED') {
      const procedures = await prisma.wOProcedure.findMany({
        where: { workOrderId: id },
        include: { steps: true }
      })
      let uncheckedMandatory = 0
      for (const proc of procedures) {
        for (const step of proc.steps) {
          if (!step.isMandatory) continue
          const isIncomplete = step.type === 'CHECKBOX' ? !step.isChecked : !step.stringValue
          if (isIncomplete) uncheckedMandatory++
        }
      }
      if (uncheckedMandatory > 0) {
        return NextResponse.json(
          { error: `Cannot complete: ${uncheckedMandatory} mandatory procedure step(s) incomplete` },
          { status: 422 }
        )
      }

      // Check all subtasks are completed
      const incompleteSubtasks = await prisma.subtask.findMany({
        where: {
          workOrderId: id,
          status: { not: 'COMPLETED' }
        }
      })
      if (incompleteSubtasks.length > 0) {
        return NextResponse.json(
          { error: `Cannot complete: ${incompleteSubtasks.length} subtask(s) still incomplete` },
          { status: 422 }
        )
      }
    }

    // ===== BUILD UPDATE DATA =====
    const updateData: Record<string, unknown> = { status }
    if (status === 'IN_PROGRESS' && !wo.startedAt) updateData.startedAt = new Date()
    if (status === 'IN_PROGRESS' && !wo.respondedAt) updateData.respondedAt = new Date()
    
    // Track completion
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date()
      updateData.completedById = user.userId
      
      // Determine completion type (assigned vs override)
      const completionAccess = await canCompleteWorkOrder(user, id)
      updateData.completionType = getCompletionType(user, completionAccess.isOverride || false)
    }
    
    if (notes) updateData.notes = notes
    if (laborHours) updateData.laborHours = laborHours
    if (laborCost) updateData.laborCost = laborCost

    const updated = await prisma.workOrder.update({ where: { id }, data: updateData })

    // Create a status history record
    await prisma.workOrderStatusHistory.create({
      data: {
        workOrderId:   id,
        status:        updated.status,
        changedById:   user.userId,
        changedByName: user.name,
        notes:         notes || `Status transitioned from ${wo.status} to ${updated.status}`,
      }
    })

    await writeAudit({
      action: 'STATUS_CHANGE',
      entity: 'WorkOrder',
      entityId: updated.id,
      entityName: updated.title,
      changes: {
        status: { before: wo.status, after: updated.status }
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })
    
    // ===== UPDATE ASSET METRICS =====
    // When WO is completed, recalculate asset metrics
    if (status === 'COMPLETED' && wo.assetId) {
      try {
        await updateAssetMetrics(wo.assetId)
      } catch (err) {
        console.error('Failed to update asset metrics:', err)
        // Don't fail the request if metrics calculation fails
      }
    }
    
    // ===== UPDATE ASSET STATUS =====
    if (wo.assetId) {
      if (status === 'IN_PROGRESS') {
        await prisma.asset.update({
          where: { id: wo.assetId },
          data: { status: 'UNDER_MAINTENANCE' }
        })
      } else if (status === 'COMPLETED' || status === 'CANCELLED') {
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
    
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
