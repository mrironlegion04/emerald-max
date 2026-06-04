import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'
import { TeamTrade } from '@prisma/client'

const updateTeamSchema = z.object({
  name:        z.string().min(1, 'Team name is required').optional(),
  trade:       z.nativeEnum(TeamTrade).optional(),
  description: z.string().nullable().optional(),
})

const manageMembersSchema = z.object({
  memberIds: z.array(z.string()),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
        workOrders: {
          select: {
            id: true,
            woNumber: true,
            title: true,
            status: true,
            priority: true,
          },
          take: 10,
        },
      },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    return NextResponse.json(team)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !['ADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const existingTeam = await prisma.team.findUnique({ where: { id } })
    if (!existingTeam) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    if (existingTeam.isDeleted) {
      return NextResponse.json({ error: 'Cannot edit a deleted team. Restore it first.' }, { status: 400 })
    }

    // Check if it's a member management request (POST-style)
    if (body.action === 'add-member') {
      const { userId } = z.object({ userId: z.string() }).parse(body)
      
      await prisma.teamMember.create({
        data: { teamId: id, userId },
      })

      await writeAudit({
        action: 'UPDATE',
        entity: 'Team',
        entityId: id,
        entityName: `Added member to team`,
        userId: user.userId,
        userName: user.name,
        userEmail: user.email,
      })

      const updatedTeam = await prisma.team.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
      })

      return NextResponse.json(updatedTeam)
    }

    if (body.action === 'remove-member') {
      const { userId } = z.object({ userId: z.string() }).parse(body)
      
      await prisma.teamMember.deleteMany({
        where: { teamId: id, userId },
      })

      await writeAudit({
        action: 'UPDATE',
        entity: 'Team',
        entityId: id,
        entityName: `Removed member from team`,
        userId: user.userId,
        userName: user.name,
        userEmail: user.email,
      })

      const updatedTeam = await prisma.team.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
      })

      return NextResponse.json(updatedTeam)
    }

    // Regular update
    const data = updateTeamSchema.parse(body)

    const updatedTeam = await prisma.team.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.trade && { trade: data.trade }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    })

    await writeAudit({
      action: 'UPDATE',
      entity: 'Team',
      entityId: id,
      entityName: updatedTeam.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(updatedTeam)
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update team' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can archive teams' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

    if (team.isDeleted) {
      return NextResponse.json({ error: 'Team is already archived' }, { status: 400 })
    }

    if (!force) {
      const activeWOs = await prisma.workOrder.count({
        where: {
          teamId: id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      })

      if (activeWOs > 0) {
        return NextResponse.json({
          error: `Team has ${activeWOs} active work order${activeWOs !== 1 ? 's' : ''}. Archive them or reassign first.`,
          requiresForce: true,
          activeWorkOrders: activeWOs,
        }, { status: 409 })
      }
    }

    // Soft-delete: preserve all historical data and team member relationships
    await prisma.team.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.userId,
      },
    })

    await writeAudit({
      action: 'DELETE',
      entity: 'Team',
      entityId: id,
      entityName: team.name,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to archive team' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can restore teams' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    if (body.action !== 'restore') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    if (!team.isDeleted) {
      return NextResponse.json({ error: 'Team is not archived' }, { status: 400 })
    }

    const restored = await prisma.team.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        restoredAt: new Date(),
        restoredBy: user.userId,
      },
      include: {
        members: { include: { user: true } },
        workOrders: { select: { id: true } },
      },
    })

    await writeAudit({
      action: 'UPDATE',
      entity: 'Team',
      entityId: id,
      entityName: team.name,
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
    return NextResponse.json({ error: 'Failed to restore team' }, { status: 500 })
  }
}
