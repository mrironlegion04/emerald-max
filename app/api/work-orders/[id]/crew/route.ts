import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { canEditWorkOrder, canViewWorkOrder } from '@/lib/access-control'
import { notificationEmitter } from '@/lib/events'
import { z } from 'zod'

const setSchema = z.object({
  userIds: z.array(z.string()).optional().default([]),
})

async function buildCrewPayload(workOrderId: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      team: {
        select: {
          id: true,
          name: true,
          members: {
            include: { user: { select: { id: true, name: true, isActive: true } } },
          },
        },
      },
      performers: {
        include: { user: { select: { id: true, name: true, isActive: true } } },
        orderBy: { createdAt: 'asc' as const },
      },
    },
  })
  if (!wo) return null

  const currentMemberIds = new Set((wo.team?.members ?? []).map(m => m.user.id))

  return {
    team: wo.team ? { id: wo.team.id, name: wo.team.name } : null,
    eligible: (wo.team?.members ?? []).map(m => ({
      userId: m.user.id,
      name: m.user.name,
      role: m.role,
      isActive: m.user.isActive,
      recorded: wo.performers.some(p => p.userId === m.user.id),
    })),
    recorded: wo.performers.map(p => ({
      id: p.id,
      userId: p.userId,
      performerName: p.performerName,
      teamName: p.teamName,
      role: p.role,
      addedByName: p.addedByName,
      createdAt: p.createdAt.toISOString(),
      isInTeam: p.userId ? currentMemberIds.has(p.userId) : false,
      userActive: p.user?.isActive ?? null,
    })),
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { allowed } = await canViewWorkOrder(user, id)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const payload = await buildCrewPayload(id)
    if (!payload) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json(payload)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch crew' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const editAccess = await canEditWorkOrder(user, id)
    if (!editAccess.allowed) {
      return NextResponse.json({ error: editAccess.reason }, { status: 403 })
    }

    const body = await request.json()
    const { userIds } = setSchema.parse(body)
    const requestedIds = [...new Set(userIds)]

    const wo = await prisma.workOrder.findUnique({
      where: { id },
      select: {
        title: true,
        team: {
          select: {
            id: true,
            name: true,
            members: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
        performers: { select: { id: true, userId: true } },
      },
    })
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (!wo.team) {
      return NextResponse.json(
        { error: 'Work order has no team assigned, so participants cannot be recorded' },
        { status: 400 }
      )
    }

    const existingByUserId = new Map(
      wo.performers.filter(p => p.userId).map(p => [p.userId as string, p.id])
    )
    const existingIds = new Set(existingByUserId.keys())

    // Additions must be current team members only
    const additions = requestedIds.filter(uid => !existingIds.has(uid))
    const currentMemberIds = new Set(wo.team.members.map(m => m.user.id))
    const invalidAdditions = additions.filter(uid => !currentMemberIds.has(uid))
    if (invalidAdditions.length > 0) {
      return NextResponse.json(
        { error: 'You can only record participants who are members of the assigned team' },
        { status: 400 }
      )
    }

    // Removals of already-recorded participants are always allowed (data correction)
    const removals = [...existingIds].filter(uid => !requestedIds.includes(uid))

    const memberByName = new Map(
      wo.team.members.map(m => [m.user.id, { name: m.user.name, role: m.role }])
    )

    await prisma.$transaction(async tx => {
      if (removals.length > 0) {
        await tx.workOrderPerformer.deleteMany({
          where: { workOrderId: id, userId: { in: removals } },
        })
      }
      if (additions.length > 0) {
        await tx.workOrderPerformer.createMany({
          data: additions.map(uid => ({
            workOrderId: id,
            userId: uid,
            performerName: memberByName.get(uid)?.name ?? 'Unknown',
            teamId: wo.team!.id,
            teamName: wo.team!.name,
            role: memberByName.get(uid)?.role ?? 'MEMBER',
            addedById: user.userId,
            addedByName: user.name,
          })),
        })
      }
    })

    await writeAudit({
      action: 'UPDATE',
      entity: 'Work Order',
      entityId: id,
      entityName: wo.title,
      changes: {
        crew: {
          before: [...existingIds].length,
          after: requestedIds.length,
        },
      },
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    notificationEmitter.emit(`activity:${id}`)

    const payload = await buildCrewPayload(id)
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update crew' }, { status: 500 })
  }
}
