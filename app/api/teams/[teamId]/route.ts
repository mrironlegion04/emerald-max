import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  trade: z.string().min(1).optional(),
  description: z.string().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await params
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
      _count: { select: { workOrders: true } },
    },
  })

  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    ...team,
    workOrders: undefined,
    _count: undefined,
    activeWorkOrders: team._count.workOrders,
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await params
  const body = await request.json()

  const team = await prisma.team.findUnique({ where: { id: teamId } })
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Action: add-member
  if (body.action === 'add-member') {
    if (!(await hasPermission(user, 'team:manage_members'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = body.userId as string
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    })
    if (existing) {
      return NextResponse.json({ error: 'User already in team' }, { status: 409 })
    }

    await prisma.teamMember.create({
      data: {
        teamId,
        userId,
        role: body.memberRole === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      },
    })

    const updated = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    })

    return NextResponse.json(updated)
  }

  // Action: remove-member
  if (body.action === 'remove-member') {
    if (!(await hasPermission(user, 'team:manage_members'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = body.userId as string
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    await prisma.teamMember.deleteMany({
      where: { teamId, userId },
    })

    const updated = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    })

    return NextResponse.json(updated)
  }

  // Action: update-member-role
  if (body.action === 'update-member-role') {
    if (!(await hasPermission(user, 'team:manage_members'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = body.userId as string
    const memberRole = body.memberRole as string
    if (!userId || !memberRole) {
      return NextResponse.json({ error: 'userId and memberRole required' }, { status: 400 })
    }

    await prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role: memberRole === 'ADMIN' ? 'ADMIN' : 'MEMBER' },
    })

    const updated = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    })

    return NextResponse.json(updated)
  }

  // Default: update team details
  if (!(await hasPermission(user, 'team:edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: parsed.data,
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission(user, 'team:delete'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { teamId } = await params
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, isDeleted: true },
  })

  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Soft delete (archive)
  if (!team.isDeleted) {
    const activeWorkOrders = await prisma.workOrder.count({
      where: { teamId, status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD'] } },
    })

    if (activeWorkOrders > 0 && !force) {
      return NextResponse.json(
        { requiresForce: true, activeWorkOrders },
        { status: 409 }
      )
    }

    await prisma.team.update({
      where: { id: teamId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    })

    return NextResponse.json({ success: true })
  }

  // Hard delete if already soft-deleted
  await prisma.team.delete({ where: { id: teamId } })
  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission(user, 'team:edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { teamId } = await params
  const body = await request.json()

  if (body.action === 'restore') {
    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team?.isDeleted) {
      return NextResponse.json({ error: 'Not found or not deleted' }, { status: 404 })
    }

    const restored = await prisma.team.update({
      where: { id: teamId },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        restoredAt: new Date(),
        restoredBy: user.userId,
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    })

    return NextResponse.json(restored)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
