import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { sendWOAssigned } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { buildWOVisibilityFilter, canAssignTeams, canAssignUsers, canWriteToAssets, canWriteToLocations, canWriteToTeams, getUserLocationIds, hasScopeActionFlag } from '@/lib/access-control'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'
import {
  normalizeWorkOrderAssets,
  syncWorkOrderAssets,
} from '@/lib/work-order-assets'
import { generateWONumber } from '@/lib/wo-number'
import { resolveShift } from '@/lib/shift'
import { isDescendantOf } from '@/lib/asset-hierarchy'

const woSchema = z.object({
  title:               z.string().min(1, 'Title is required'),
  description:         z.string().nullable().optional(),
  type:                z.enum(['BREAKDOWN','PREVENTIVE','PREDICTIVE']).default('BREAKDOWN'),
  priority:            z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  status:              z.enum(['OPEN','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED']).default('OPEN'),
  dueDate:             z.string().nullable().optional(),
  startDate:           z.string().nullable().optional(),
  assetId:             z.string().nullable().optional(),
  failedComponentId:   z.string().nullable().optional(),
  locationId:          z.string().nullable().optional(),
  locationScope:       z.enum(['ALL_ASSETS', 'GENERAL']).nullable().optional(),
  selectedAssetIds:    z.array(z.string()).optional().default([]),
  assignedToId:        z.string().nullable().optional(),
  teamId:              z.string().nullable().optional(),
  laborHours:          z.number().nullable().optional(),
  laborCost:           z.number().nullable().optional(),
  partsCost:           z.number().nullable().optional(),
  notes:               z.string().nullable().optional(),
  customFields:        z.record(z.string(), z.any()).nullable().optional(),
  issueId:             z.string().nullable().optional(),
  customIssue:         z.string().nullable().optional(),
  domainId:            z.string().nullable().optional(),
  woCategoryId:        z.string().nullable().optional(),
  downtimeStartedAt:   z.string().nullable().optional(),

}).refine(
  data => !(data.issueId && data.customIssue),
  { message: 'Provide either a standard issue or custom description, not both' }
)

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const visibilityFilter = await buildWOVisibilityFilter(user)

    const whereClause = visibilityFilter ? { AND: [visibilityFilter] } : {}

    const wos = await prisma.workOrder.findMany({
      where: whereClause,
      include: {
        asset:        { select: { id: true, name: true, assetCode: true } },
        assets:       { include: { asset: { select: { id: true, name: true, assetCode: true } } } },
        assignedTo:   { select: { id: true, name: true } },
        subtasks:     { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(wos)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch work orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const canCreate = await hasPermission(user, 'wo:create')
    if (!canCreate) {
      return NextResponse.json({ error: 'You do not have permission to create work orders' }, { status: 403 })
    }

    if (!(await hasScopeActionFlag(user, 'canEditWO'))) {
      return NextResponse.json({ error: 'Your scope does not allow creating work orders' }, { status: 403 })
    }

    const body = await request.json()
    const data = woSchema.parse(body)

    if (data.customIssue) {
      data.customIssue = data.customIssue.trim()
      if (data.customIssue.length === 0) data.customIssue = null
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } })
    if (!dbUser) {
      return NextResponse.json({ error: 'User session invalid. Please log in again.' }, { status: 401 })
    }

    // RequestedBy = creating user, with their team when they have one
    const userTeam = await prisma.teamMember.findFirst({
      where: { userId: user.userId },
      select: { team: { select: { name: true, isActive: true, isDeleted: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const requestedBy =
      userTeam?.team.isActive && !userTeam.team.isDeleted
        ? `${user.name} (${userTeam.team.name})`
        : user.name

    // ── Normalize asset scope ────────────────────────────────────────
    const normalized = await normalizeWorkOrderAssets(
      data.assetId,
      data.selectedAssetIds,
      data.locationId,
      data.locationScope,
    )

    // ── Failed component must be a descendant of the primary asset ───
    const failedComponentId: string | null = data.failedComponentId ?? null
    if (failedComponentId) {
      if (!normalized.assetId) {
        return NextResponse.json(
          { error: 'Failed component requires a primary asset to be selected' },
          { status: 400 }
        )
      }
      if (failedComponentId === normalized.assetId) {
        return NextResponse.json(
          { error: 'Failed component must be a component within the asset, not the asset itself' },
          { status: 400 }
        )
      }
      const allAssets = await prisma.asset.findMany({
        where: { isDeleted: false },
        select: { id: true, parentId: true },
      })
      if (!isDescendantOf(allAssets, normalized.assetId, failedComponentId)) {
        return NextResponse.json(
          { error: 'Failed component must be a component within the selected asset' },
          { status: 400 }
        )
      }
    }

    // ── Derive WO location from primary asset when not explicitly set ─
    let locationId: string | null = data.locationId ?? null
    if (!locationId && normalized.entries.length > 0) {
      const primaryAssetId = normalized.assetId ?? normalized.entries[0].assetId
      const primaryAsset = await prisma.asset.findUnique({
        where: { id: primaryAssetId },
        select: { locationId: true },
      })
      locationId = primaryAsset?.locationId ?? null
    }

    // ── Plant scope enforcement ───────────────────────────────────────
    const inScope =
      (await canWriteToLocations(user, [locationId])) &&
      (await canWriteToAssets(user, normalized.entries.map(e => e.assetId))) &&
      (await canAssignUsers(user, [data.assignedToId])) &&
      (await canAssignTeams(user, [data.teamId])) &&
      (await canWriteToTeams(user, [data.teamId]))
    if (!inScope) {
      return NextResponse.json(
        { error: 'You do not have access to the selected location, asset, or assignee' },
        { status: 403 }
      )
    }

    // ── Validate work order category ───────────────────────────────────
    if (data.woCategoryId) {
      const category = await prisma.workOrderCategory.findUnique({
        where: { id: data.woCategoryId },
        select: { id: true, isActive: true },
      })
      if (!category || !category.isActive) {
        return NextResponse.json({ error: 'Work order category not found' }, { status: 400 })
      }
    }

    const woNumber = await generateWONumber()

    // ── Auto-derive domainId from team ───────────────────────────────
    let derivedDomainId: string | null = null
    if (data.teamId) {
      const teamDomain = await prisma.teamDomain.findFirst({
        where: { teamId: data.teamId },
        include: { domain: true },
      })
      derivedDomainId = teamDomain?.domainId ?? null
    }

    // ── 1 Domain → 1 Issue → optional Custom Issue ───────────────────
    const woDomainId = data.domainId !== undefined ? data.domainId : derivedDomainId
    if (data.domainId) {
      const domain = await prisma.maintenanceDomain.findUnique({
        where: { id: data.domainId },
        select: { id: true, isActive: true },
      })
      if (!domain || !domain.isActive) {
        return NextResponse.json({ error: 'Domain not found' }, { status: 400 })
      }
    }
    if (data.issueId && data.domainId) {
      const issue = await prisma.issue.findUnique({
        where: { id: data.issueId },
        select: { id: true, isGlobal: true, domains: { select: { domainId: true } } },
      })
      if (issue && !issue.isGlobal && !issue.domains.some(d => d.domainId === data.domainId)) {
        return NextResponse.json({ error: 'Issue does not belong to the selected domain' }, { status: 400 })
      }
    }

    const wo = await prisma.workOrder.create({
      data: {
        woNumber,
        title:          data.title,
        description:    data.description  ?? null,
        type:           data.type,
        priority:       data.priority,
        status:         data.status,
        dueDate:        data.dueDate      ? new Date(data.dueDate) : null,
        startDate:      data.startDate    ? new Date(data.startDate) : null,
        assetId:        normalized.assetId,
        failedComponentId,
        locationId:     locationId,
        locationScope:  data.locationScope ?? null,
        assignedToId:   data.assignedToId ?? null,
        teamId:         data.teamId       ?? null,
        domainId:       woDomainId,
        createdById:    user.userId,
        laborHours:     data.laborHours   ?? null,
        laborCost:      data.laborCost    ?? null,
        partsCost:      data.partsCost    ?? null,
        notes:          data.notes        ?? null,
        customFields:   data.customFields as any ?? undefined,
        issueId:        data.issueId      ?? null,
        customIssue:    data.customIssue  ?? null,
        shift:          await resolveShift(),
        requestedBy,
        requestedById:  user.userId,
        woCategoryId:   data.woCategoryId ?? null,
        downtimeStartedAt: data.downtimeStartedAt ? new Date(data.downtimeStartedAt) : null,
        startedAt:      data.status === 'IN_PROGRESS' ? new Date() : null,
        completedAt:    data.status === 'COMPLETED'   ? new Date() : null,
      },
    })

    // Create initial status history record
    await prisma.workOrderStatusHistory.create({
      data: {
        workOrderId:   wo.id,
        status:        wo.status,
        changedById:   user.userId,
        changedByName: user.name,
        notes:         'Initial work order creation',
      }
    })

    // ── Sync WorkOrderAsset rows (freezes the scope at creation) ─────
    if (normalized.entries.length > 0) {
      await syncWorkOrderAssets(wo.id, normalized.entries)
    }
    await writeAudit({
      action: 'CREATE', entity: 'Work Order',
      entityId: wo.id, entityName: wo.title,
      userId: user.userId, userName: user.name, userEmail: user.email,
    })

    if (data.assignedToId) {
      await createNotification({
        userId: data.assignedToId, title: `WO ${wo.woNumber} Assigned`,
        message: wo.title, type: 'WORK_ORDER_ASSIGNED', entityId: wo.id,
        href: `/work-orders/${wo.id}`,
      })
      const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } })
      if (assignee) {
        await sendWOAssigned({
          toEmail: assignee.email, toName: assignee.name,
          woNumber: wo.woNumber, woTitle: wo.title, woId: wo.id,
          priority: wo.priority, dueDate: wo.dueDate?.toISOString() ?? null,
          assetName: null,
        }).catch(console.error)
      }
    }

    if (data.teamId) {
      const teamMembers = await prisma.teamMember.findMany({
        where: { teamId: data.teamId },
        include: { user: true },
      })
      for (const member of teamMembers) {
        // Plant isolation: only notify team members whose scope covers this work order
        const memberScope = await getUserLocationIds(member.user.id)
        if (memberScope && (!wo.locationId || !memberScope.includes(wo.locationId))) continue
        await createNotification({
          userId: member.user.id,
          title: `WO ${wo.woNumber} Assigned to Your Team`,
          message: wo.title, type: 'WORK_ORDER_ASSIGNED',
          entityId: wo.id, href: `/work-orders/${wo.id}`,
        }).catch(console.error)
        await sendWOAssigned({
          toEmail: member.user.email, toName: member.user.name,
          woNumber: wo.woNumber, woTitle: wo.title, woId: wo.id,
          priority: wo.priority, dueDate: wo.dueDate?.toISOString() ?? null,
          assetName: null,
        }).catch(console.error)
      }
    }

    return NextResponse.json(wo, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create work order' }, { status: 500 })
  }
}
