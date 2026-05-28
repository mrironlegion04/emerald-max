import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const addPartSchema = z.object({
  partId:   z.string().min(1),
  quantity: z.number().int().min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: workOrderId } = await params
    const body = await request.json()
    const { partId, quantity } = addPartSchema.parse(body)

    // Verify WO exists and is not closed
    const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } })
    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    if (['COMPLETED','CANCELLED'].includes(wo.status)) {
      return NextResponse.json({ error: 'Cannot add parts to a closed work order' }, { status: 422 })
    }

    // Get part info
    const part = await prisma.part.findUnique({ where: { id: partId } })
    if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    if (part.isDeleted) {
      return NextResponse.json({ error: 'Cannot add an archived part to a work order' }, { status: 400 })
    }

    // Create WO part record and update work order cost atomically without touching stock levels
    const [wopart] = await prisma.$transaction([
      prisma.workOrderPart.create({
        data: {
          workOrderId,
          partId,
          quantity,
          unitCost: part.unitCost,
        },
      }),
      // Update parts cost on WO
      prisma.workOrder.update({
        where: { id: workOrderId },
        data:  { partsCost: { increment: quantity * (part.unitCost ?? 0) } },
      }),
    ])

    await writeAudit({
      action: 'UPDATE',
      entity: 'Work Order',
      entityId: wo.id,
      entityName: wo.title,
      changes: {
        [`Part Added: ${part.name}`]: {
          before: 'None',
          after: `Quantity: ${quantity}`,
        }
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(wopart, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to add part' }, { status: 500 })
  }
}
