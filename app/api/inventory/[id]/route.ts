import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const updateSchema = z.object({
  name:        z.string().min(1).optional(),
  partNumber:  z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  unitCost:    z.number().nullable().optional(),
  unit:        z.string().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const part = await prisma.part.findUnique({
      where: { id },
      include: {
        usedInWorkOrders: {
          include: { workOrder: { select: { id: true, woNumber: true, title: true, status: true } } },
        },
      },
    })
    if (!part) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(part)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch part' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    const { id } = await params
    const body   = await request.json()
    const data   = updateSchema.parse(body)

    const existingPart = await prisma.part.findUnique({ where: { id } })
    if (!existingPart) return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    if (existingPart.isDeleted) {
      return NextResponse.json({ error: 'Cannot edit an archived part' }, { status: 400 })
    }

    if (data.partNumber) {
      const existing = await prisma.part.findFirst({
        where: { partNumber: data.partNumber, NOT: { id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'Part number already in use' }, { status: 409 })
      }
    }

    const part = await prisma.part.update({ where: { id }, data })

    const changes: Record<string, { before: any; after: any }> = {}
    for (const key of Object.keys(data)) {
      const beforeVal = existingPart[key as keyof typeof existingPart]
      const afterVal = part[key as keyof typeof part]
      const beforeStr = beforeVal instanceof Date ? beforeVal.toISOString() : JSON.stringify(beforeVal)
      const afterStr = afterVal instanceof Date ? afterVal.toISOString() : JSON.stringify(afterVal)
      if (beforeStr !== afterStr) {
        changes[key] = {
          before: beforeVal instanceof Date ? beforeVal.toISOString() : beforeVal,
          after: afterVal instanceof Date ? afterVal.toISOString() : afterVal
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      await writeAudit({
        action: 'UPDATE', entity: 'Part',
        entityId: part.id, entityName: part.name,
        changes,
        userId: user.userId, userName: user.name, userEmail: user.email,
      })
    }

    return NextResponse.json(part)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update part' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can archive parts' }, { status: 403 })
    }
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    const part = await prisma.part.findUnique({ where: { id } })
    if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    if (part.isDeleted) {
      return NextResponse.json({ error: 'Part is already archived' }, { status: 400 })
    }

    if (!force) {
      const activeWOs = await prisma.workOrderPart.count({
        where: {
          partId: id,
          workOrder: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        },
      })
      if (activeWOs > 0) {
        return NextResponse.json({
          error: `Part is used in ${activeWOs} active work order${activeWOs !== 1 ? 's' : ''}.`,
          requiresForce: true,
          activeWorkOrders: activeWOs,
        }, { status: 409 })
      }
    }

    await prisma.part.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    })

    await writeAudit({
      action: 'DELETE', entity: 'Part',
      entityId: id, entityName: part.name,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to archive part' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can restore parts' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    if (body.action !== 'restore') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const part = await prisma.part.findUnique({ where: { id } })
    if (!part) return NextResponse.json({ error: 'Part not found' }, { status: 404 })
    if (!part.isDeleted) {
      return NextResponse.json({ error: 'Part is not archived' }, { status: 400 })
    }

    const restored = await prisma.part.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        restoredAt: new Date(),
        restoredBy: user.userId,
      },
    })

    await writeAudit({
      action: 'UPDATE',
      entity: 'Part',
      entityId: id,
      entityName: part.name,
      changes: {
        isDeleted: { before: true, after: false },
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(restored)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to restore part' }, { status: 500 })
  }
}
