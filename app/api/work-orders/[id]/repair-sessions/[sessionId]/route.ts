import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { canEditWorkOrder } from '@/lib/access-control'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const sessionSchema = z.object({
  startedAt:   z.string().optional(),
  completedAt: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, sessionId } = await params
    const body = await request.json()
    const data = sessionSchema.parse(body)

    const session = await prisma.repairSession.findFirst({
      where: { id: sessionId, workOrderId: id },
    })
    if (!session) return NextResponse.json({ error: 'Repair session not found' }, { status: 404 })

    const editAccess = await canEditWorkOrder(user, id)
    if (!editAccess.allowed) {
      return NextResponse.json({ error: editAccess.reason ?? 'You do not have permission to edit this work order' }, { status: 403 })
    }

    const started = data.startedAt !== undefined ? new Date(data.startedAt) : session.startedAt
    const completed = data.completedAt !== undefined
      ? (data.completedAt ? new Date(data.completedAt) : null)
      : session.completedAt

    if (completed && completed.getTime() <= started.getTime()) {
      return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (data.startedAt !== undefined) updateData.startedAt = started
    if (data.completedAt !== undefined) {
      updateData.completedAt = completed
      updateData.completedById = completed ? (session.completedById ?? user.userId) : null
    }
    if (data.startedAt !== undefined || data.completedAt !== undefined) {
      updateData.durationMinutes = completed
        ? Math.max(0, Math.floor((completed.getTime() - started.getTime()) / 60000))
        : null
    }

    const updated = await prisma.repairSession.update({ where: { id: sessionId }, data: updateData })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update repair session' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id, sessionId } = await params
    const session = await prisma.repairSession.findFirst({
      where: { id: sessionId, workOrderId: id },
    })
    if (!session) return NextResponse.json({ error: 'Repair session not found' }, { status: 404 })

    const editAccess = await canEditWorkOrder(user, id)
    if (!editAccess.allowed) {
      return NextResponse.json({ error: editAccess.reason ?? 'You do not have permission to edit this work order' }, { status: 403 })
    }

    const isOpenSession = !session.completedAt

    await prisma.$transaction(async (tx) => {
      await tx.repairSession.delete({ where: { id: sessionId } })

      // Deleting the last open session means work is no longer in progress —
      // reset the work order back to OPEN so it doesn't stay stuck "in progress".
      if (isOpenSession) {
        const otherOpen = await tx.repairSession.count({
          where: { workOrderId: id, completedAt: null },
        })
        if (otherOpen === 0) {
          const wo = await tx.workOrder.findUnique({
            where: { id },
            select: { status: true, assetId: true, title: true },
          })
          if (wo && (wo.status === 'IN_PROGRESS' || wo.status === 'ON_HOLD')) {
            await tx.workOrder.update({
              where: { id },
              data: { status: 'OPEN', startedAt: null, respondedAt: null },
            })
            await tx.workOrderStatusHistory.create({
              data: {
                workOrderId: id,
                status: 'OPEN',
                changedById: user.userId,
                changedByName: user.name,
                notes: `In-progress repair session #${session.sessionNo} deleted; work order reverted to OPEN`,
              },
            })
            await writeAudit({
              action: 'STATUS_CHANGE',
              entity: 'WorkOrder',
              entityId: id,
              entityName: wo.title,
              changes: {
                status: { before: wo.status, after: 'OPEN' },
              },
              userId: user.userId,
              userName: user.name,
              userEmail: user.email,
            })
            if (wo.assetId) {
              const asset = await tx.asset.findUnique({
                where: { id: wo.assetId },
                select: { status: true },
              })
              if (asset?.status === 'UNDER_MAINTENANCE') {
                await tx.asset.update({
                  where: { id: wo.assetId },
                  data: { status: 'ACTIVE' },
                })
              }
            }
          }
        }
      }

      // Keep session numbers contiguous after a deletion
      const remaining = await tx.repairSession.findMany({
        where: { workOrderId: id },
        orderBy: { sessionNo: 'asc' },
      })
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].sessionNo !== i + 1) {
          await tx.repairSession.update({
            where: { id: remaining[i].id },
            data: { sessionNo: i + 1 },
          })
        }
      }
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete repair session' }, { status: 500 })
  }
}
