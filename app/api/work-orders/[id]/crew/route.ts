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

  // Any active user can be recorded as a participant — no plant/team restriction.
  // Members of the WO's assigned team are flagged so the UI can recommend them first.
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' as const },
  })

  return {
    team: wo.team ? { id: wo.team.id, name: wo.team.name } : null,
    users: users.map(u => ({ ...u, inTeam: currentMemberIds.has(u.id) })),
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
            members: { select: { userId: true, role: true } },
          },
        },
        performers: { select: { id: true, userId: true } },
      },
    })
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const existingByUserId = new Map(
      wo.performers.filter(p => p.userId).map(p => [p.userId as string, p.id])
    )
    const existingIds = new Set(existingByUserId.keys())

    // Additions must be existing, active users — recording has no team/plant
    // restriction, so any active user may be recorded.
    const additions = requestedIds.filter(uid => !existingIds.has(uid))
    const validUsers = additions.length > 0
      ? await prisma.user.findMany({ where: { id: { in: additions } }, select: { id: true, name: true, isActive: true } })
      : []
    const validByName = new Map(validUsers.map(u => [u.id, u.name]))
    const invalidAdditions = additions.filter(uid => !validUsers.some(u => u.id === uid) || !validUsers.some(u => u.id === uid && u.isActive))
    if (invalidAdditions.length > 0) {
      return NextResponse.json(
        { error: 'One or more users are not active or do not exist' },
        { status: 400 }
      )
    }

    // Removals of already-recorded participants are always allowed (data correction)
    const removals = [...existingIds].filter(uid => !requestedIds.includes(uid))

    const primaryMemberByUserId = new Map(
      (wo.team?.members ?? []).map(m => [m.userId, m.role])
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
            performerName: validByName.get(uid) ?? 'Unknown',
            teamId: wo.team && primaryMemberByUserId.has(uid) ? wo.team.id : null,
            teamName: wo.team && primaryMemberByUserId.has(uid) ? wo.team.name : null,
            role: primaryMemberByUserId.get(uid) ?? null,
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
          after: [...new Set(requestedIds)].length,
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
