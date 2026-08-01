import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { canViewWorkOrder, canAssignUsers, canAssignTeams } from '@/lib/access-control'
import { z } from 'zod'

const subtaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  dueDate: z.string().nullable().optional(),
  workOrderId: z.string().min(1, 'Work Order ID is required'),
  assignedToId: z.string().nullable().optional(),
  assignedTeamId: z.string().nullable().optional(),
  required: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const workOrderId = searchParams.get('workOrderId')

    if (!workOrderId) {
      return NextResponse.json({ error: 'workOrderId is required' }, { status: 400 })
    }

    const { allowed } = await canViewWorkOrder(user, workOrderId)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const subtasks = await prisma.subtask.findMany({
      where: { workOrderId },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedDomain: { select: { id: true, name: true } },
        assignedTeam: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        workOrder: { select: { id: true, woNumber: true, title: true } },
      },
      orderBy: { order: 'asc' as const, createdAt: 'desc' as const },
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

    // Verify work order exists and is viewable
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: data.workOrderId },
    })
    if (!workOrder) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const viewAccess = await canViewWorkOrder(user, data.workOrderId)
    if (!viewAccess.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify assigned user/team are within the user's write scope
    const inScope =
      (data.assignedToId !== undefined ? await canAssignUsers(user, [data.assignedToId]) : true) &&
      (data.assignedTeamId !== undefined ? await canAssignTeams(user, [data.assignedTeamId]) : true)
    if (!inScope) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    // Verify assigned team exists if provided, and auto-derive domain
    let assignedDomainId: string | null = null
    if (data.assignedTeamId) {
      const assignedTeam = await prisma.team.findUnique({
        where: { id: data.assignedTeamId },
      })
      if (!assignedTeam) {
        return NextResponse.json({ error: 'Assigned team not found' }, { status: 404 })
      }
      // Auto-derive domain from team via TeamDomain
      const teamDomain = await prisma.teamDomain.findFirst({
        where: { teamId: data.assignedTeamId },
      })
      if (teamDomain) {
        assignedDomainId = teamDomain.domainId
      }
    }

    // Ensure mutual exclusivity: can't assign to both user and team
    if (data.assignedToId && data.assignedTeamId) {
      return NextResponse.json(
        { error: 'Cannot assign to both user and team' },
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
        assignedTeamId: data.assignedTeamId ?? null,
        assignedDomainId,
        required: data.required,
        createdById: user.userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        assignedDomain: { select: { id: true, name: true } },
        assignedTeam: { select: { id: true, name: true } },
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
