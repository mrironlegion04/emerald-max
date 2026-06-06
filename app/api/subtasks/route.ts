import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'

const subtaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  dueDate: z.string().nullable().optional(),
  workOrderId: z.string().min(1, 'Work Order ID is required'),
  assignedToId: z.string().nullable().optional(),
  assignedDomainId: z.string().nullable().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workOrderId = searchParams.get('workOrderId')

    const where = workOrderId ? { workOrderId } : {}

    const subtasks = await prisma.subtask.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedDomain: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        workOrder: { select: { id: true, woNumber: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(subtasks)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch subtasks' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const data = subtaskSchema.parse(body)

    // Verify work order exists
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: data.workOrderId },
    })
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
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

    // Verify assigned domain exists if provided
    if (data.assignedDomainId) {
      const assignedDomain = await prisma.maintenanceDomain.findUnique({
        where: { id: data.assignedDomainId },
      })
      if (!assignedDomain) {
        return NextResponse.json({ error: 'Assigned domain not found' }, { status: 404 })
      }
    }

    // Ensure mutual exclusivity: can't assign to both user and domain
    if (data.assignedToId && data.assignedDomainId) {
      return NextResponse.json(
        { error: 'Cannot assign to both user and industrial domain' },
        { status: 400 }
      )
    }

    const subtask = await prisma.subtask.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        workOrderId: data.workOrderId,
        assignedToId: data.assignedToId ?? null,
        assignedDomainId: data.assignedDomainId ?? null,
        createdById: user.userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedDomain: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        workOrder: { select: { id: true, woNumber: true, title: true } },
      },
    })

    // Audit log
    await writeAudit({
      action: 'CREATE',
      entity: 'Subtask',
      entityId: subtask.id,
      entityName: subtask.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(subtask, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create subtask' }, { status: 500 })
  }
}
