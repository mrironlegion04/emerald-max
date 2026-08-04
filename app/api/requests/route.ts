import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { createNotificationForUsers } from '@/lib/notifications'
import { generateRequestNumber } from '@/lib/request-number'
import { getUserTeamScope, getUserLocationIds } from '@/lib/access-control'
import { z } from 'zod'

const attachmentSchema = z.object({
  url: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.string().optional(),
  size: z.number().optional(),
})

const schema = z.object({
  title: z.string().min(1), description: z.string().min(1),
  location: z.string().optional(), requesterName: z.string().min(1).optional(),
  requesterEmail: z.string().email().optional().or(z.literal('')),
  requesterPhone: z.string().optional(),
  priority: z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  requestType: z.enum(['REPAIR','MAINTENANCE','INSPECTION','INSTALLATION','OTHER']).optional(),
  assetId: z.string().optional(),
  issueId: z.string().optional(),
  teamId: z.string().optional(),
  desiredDate: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let where: Record<string, unknown> | undefined

  if (user.role === 'REQUESTER') {
    where = {
      OR: [
        { requesterId: user.userId },
        { requesterName: user.name },
      ],
    }
  } else if (user.role === 'TECHNICIAN') {
    const myTeamIds = (await prisma.teamMember.findMany({
      where: { userId: user.userId },
      select: { teamId: true },
    })).map(t => t.teamId)
    where = {
      OR: [
        { requesterId: user.userId },
        ...(myTeamIds.length > 0 ? [{ teamId: { in: myTeamIds } }] : []),
      ],
    }
  } else if (user.role === 'MANAGER') {
    // Scoped managers only see requests for their assigned teams / plants.
    // Managers with no scope stay unrestricted (backward compatible).
    const teamScope = await getUserTeamScope(user.userId)
    const locationIds = await getUserLocationIds(user.userId)
    if (teamScope || locationIds) {
      const conditions: Record<string, unknown>[] = [
        { requesterId: user.userId },
      ]
      if (teamScope) {
        conditions.push({ teamId: { in: teamScope.map(s => s.teamId) } })
      }
      if (locationIds) {
        conditions.push({ asset: { locationId: { in: locationIds } } })
      }
      where = { OR: conditions }
    }
  }

  const requests = await prisma.maintenanceRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      asset: { select: { id: true, name: true, assetCode: true, location: { select: { name: true } } } },
      issue: { select: { id: true, code: true, title: true, severity: true } },
      team: { select: { id: true, name: true } },
      workOrder: { select: { id: true, woNumber: true, status: true } },
      attachments: true,
      reviewedBy: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json())
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (data.assetId) {
      const asset = await prisma.asset.findUnique({ where: { id: data.assetId }, select: { id: true } })
      if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    if (data.issueId) {
      const issue = await prisma.issue.findUnique({ where: { id: data.issueId }, select: { id: true, isActive: true } })
      if (!issue || !issue.isActive) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    if (data.teamId) {
      const team = await prisma.team.findUnique({ where: { id: data.teamId }, select: { id: true, isActive: true, isDeleted: true } })
      if (!team || !team.isActive || team.isDeleted) return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const requestNumber = await generateRequestNumber()
    const desiredDate = data.desiredDate ? new Date(data.desiredDate) : null

    const request = await prisma.maintenanceRequest.create({
      data: {
        requestNumber, title: data.title, description: data.description,
        location: data.location || null, requesterName: data.requesterName || user.name,
        requesterEmail: data.requesterEmail || user.email, requesterPhone: data.requesterPhone || null,
        priority: data.priority, requestType: data.requestType, assetId: data.assetId,
        issueId: data.issueId, teamId: data.teamId, desiredDate,
        requesterId: user.userId,
        attachments: data.attachments && data.attachments.length > 0 ? {
          create: data.attachments.map(a => ({
            filename: a.url.split('/').pop() ?? 'attachment',
            originalName: a.originalName,
            mimeType: a.mimeType ?? 'application/octet-stream',
            size: a.size ?? 0,
            url: a.url,
            uploadedById: user.userId,
          })),
        } : undefined,
      },
    })

    await writeAudit({
      action: 'CREATE',
      entity: 'Request',
      entityId: request.id,
      entityName: request.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    // Notify staff who can review requests
    const approvers = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'MANAGER'] }, isActive: true },
      select: { id: true },
    })
    if (approvers.length > 0) {
      await createNotificationForUsers(
        approvers.map(a => a.id),
        {
          type: 'REQUEST',
          title: `New request ${requestNumber} from ${request.requesterName}`,
          message: request.title.slice(0, 100),
          href: `/requests`,
        },
      ).catch(console.error)
    }

    return NextResponse.json(request, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.issues[0].message }, { status: 400 })
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
