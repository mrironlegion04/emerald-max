import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; partUsedId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: workOrderId, partUsedId } = await params

    // Get the WO part record
    const woPart = await prisma.workOrderPart.findUnique({
      where: { id: partUsedId },
      include: { part: true },
    })
    if (!woPart) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Remove record and update work order cost atomically without touching stock levels
    await prisma.$transaction([
      prisma.workOrderPart.delete({ where: { id: partUsedId } }),
      prisma.workOrder.update({
        where: { id: workOrderId },
        data:  { partsCost: { decrement: woPart.quantity * (woPart.unitCost ?? 0) } },
      }),
    ])


    const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId }, select: { title: true } })
    if (wo) {
      await writeAudit({
        action: 'UPDATE',
        entity: 'Work Order',
        entityId: workOrderId,
        entityName: wo.title,
        changes: {
          [`Part Removed: ${woPart.part.name}`]: {
            before: `Quantity: ${woPart.quantity}`,
            after: 'None',
          }
        },
        userId: user.userId,
        userName: user.name,
        userEmail: user.email,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to remove part' }, { status: 500 })
  }
}
