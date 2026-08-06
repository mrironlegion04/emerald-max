import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { hasPermission } from '@/lib/permissions'
import { canViewWorkOrder, canAccessTeamScope } from '@/lib/access-control'
import { z } from 'zod'
import { unlink } from 'fs/promises'
import path from 'path'
import { deleteFile } from '@/lib/minio'
import {
  canEditWorkOrder,
  canReassignWorkOrder,
  getCompletionType,
  canCompleteWorkOrder,
  canUploadWOAttachment,
  isAdmin,
  isManagerOrAbove,
  canAssignTeams,
  canAssignUsers,
  canWriteToAssets,
  canWriteToLocations,
  canWriteToTeams,
  hasScopeActionFlag,
  isValidWOStatusTransition,
} from '@/lib/access-control'
import { updateAssetMetrics, updateWorkOrderLinkedAssetMetrics } from '@/lib/metrics'
import { notificationEmitter } from '@/lib/events'
import {
  normalizeWorkOrderAssets,
  syncWorkOrderAssets,
} from '@/lib/work-order-assets'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

function isMinioConfigured(): boolean {
  return !!(process.env.MINIO_ENDPOINT && process.env.MAX_MINIO_ACCESS_KEY && process.env.MAX_MINIO_SECRET_KEY)
}

async function cleanupFile(url: string | null, key: string | null) {
  if (!url && !key) return
  const useMinIO = isMinioConfigured()
  
  // 1. MinIO deletion
  if (key && !key.startsWith('local-') && useMinIO) {
    try {
      await deleteFile(key)
    } catch (err) {
      console.error(`Cleanup: Failed to delete MinIO key ${key}:`, err)
    }
  }

  // 2. Local deletion
  if (url && url.startsWith('/uploads/')) {
    try {
      const filename = path.basename(url)
      const filepath = path.join(UPLOAD_DIR, filename)
      await unlink(filepath)
    } catch (err) {
      // ignore, file might not exist
    }
  }
}

const updateSchema = z.object({
  title:               z.string().min(1).optional(),
  description:         z.string().nullable().optional(),
  type:                z.enum(['BREAKDOWN','PREVENTIVE','PREDICTIVE']).optional(),
  priority:            z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  status:              z.enum(['OPEN','IN_PROGRESS','ON_HOLD','COMPLETED','CLOSED','CANCELLED']).optional(),
  dueDate:             z.string().nullable().optional(),
  startDate:           z.string().nullable().optional(),
  assetId:             z.string().nullable().optional(),
  locationId:          z.string().nullable().optional(),
  locationScope:       z.enum(['ALL_ASSETS', 'GENERAL']).nullable().optional(),
  selectedAssetIds:    z.array(z.string()).optional(),
  assignedToId:        z.string().nullable().optional(),
  teamId:              z.string().nullable().optional(),
  laborHours:          z.number().nullable().optional(),
  laborCost:           z.number().nullable().optional(),
  partsCost:           z.number().nullable().optional(),
  notes:               z.string().nullable().optional(),
  customFields:        z.record(z.string(), z.any()).nullable().optional(),
  issueId:             z.string().nullable().optional(),
  customIssue:         z.string().nullable().optional(),
  shift:               z.string().nullable().optional(),
  woCategoryId:        z.string().nullable().optional(),
  downtimeStartedAt:   z.string().nullable().optional(),
  downtimeEndedAt:     z.string().nullable().optional(),
}).refine(
  data => !(data.issueId && data.customIssue),
  { message: 'Provide either a standard issue or custom description, not both' }
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        asset:       true,
        assets:      { include: { asset: { select: { id: true, name: true, assetCode: true } } } },
        location:    true,
        assignedTo:  true,
        createdBy:   true,
        completedBy: true,
        issue:       true,
        partsUsed:   { include: { part: true } },
        subtasks:    { include: { assignedTo: true, completedBy: true, createdBy: true, assignedDomain: true } },
        domain:      true,
        team:        { select: { id: true, name: true, members: { include: { user: { select: { id: true, name: true, isActive: true } } } } } },

        attachments: { include: { uploadedBy: { select: { name: true } } } },
        statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' as const } },
        performers: { include: { user: { select: { id: true, name: true, isActive: true } } }, orderBy: { createdAt: 'asc' as const } },
      },
    })
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { allowed } = await canViewWorkOrder(user, wo.id)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Server-computed action flags so the UI only shows buttons the backend allows.
    const [editAccess, completeAccess, uploadAccess, closeFlag] = await Promise.all([
      canEditWorkOrder(user, wo.id),
      canCompleteWorkOrder(user, wo.id),
      canUploadWOAttachment(user, wo.id),
      hasScopeActionFlag(user, 'canCloseWO'),
    ])

    return NextResponse.json({
      ...wo,
      viewer: {
        canEdit: editAccess.allowed,
        canComplete: completeAccess.allowed,
        canUploadAttachment: uploadAccess.allowed,
        canCloseWO: closeFlag,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch work order' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existingWo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        domain: true,
        assets: { select: { assetId: true } },
      },
    })
    if (!existingWo) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const editAccess = await canEditWorkOrder(user, id)
    if (!editAccess.allowed) {
      return NextResponse.json({ error: editAccess.reason }, { status: 403 })
    }

    // Managers with team-scope rows need the canEditWO flag to edit work orders
    if (!(await hasScopeActionFlag(user, 'canEditWO'))) {
      return NextResponse.json({ error: 'Your scope does not allow editing work orders' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateSchema.parse(body)

    if (data.customIssue) {
      data.customIssue = data.customIssue.trim()
      if (data.customIssue.length === 0) data.customIssue = null
    }

    if (data.downtimeStartedAt && data.downtimeEndedAt &&
        new Date(data.downtimeEndedAt).getTime() <= new Date(data.downtimeStartedAt).getTime()) {
      return NextResponse.json({ error: 'Back up time must be after the down time' }, { status: 400 })
    }

    // ── Permission checks ─────────────────────────────────────────────
    if (data.status && !isManagerOrAbove(user)) {
      return NextResponse.json(
        { error: 'Only admin/manager can change work order status' },
        { status: 403 }
      )
    }

    // Managers with team-scope rows need the right flag for status changes
    if (data.status && user.role === 'MANAGER') {
      const needsClose = data.status === 'COMPLETED' || data.status === 'CLOSED'
      const flag = needsClose ? 'canCloseWO' : 'canEditWO'
      if (!(await hasScopeActionFlag(user, flag))) {
        return NextResponse.json(
          { error: 'Your scope does not allow changing this work order status' },
          { status: 403 }
        )
      }
    }

    if ((data.assignedToId || data.teamId) && !isManagerOrAbove(user)) {
      return NextResponse.json(
        { error: 'Only admin/manager can reassign work order' },
        { status: 403 }
      )
    }

    // Managers with team-scope rows need the canAssignWO flag to reassign
    if ((data.assignedToId !== undefined || data.teamId !== undefined) && user.role === 'MANAGER') {
      if (!(await hasScopeActionFlag(user, 'canAssignWO'))) {
        return NextResponse.json(
          { error: 'Your scope does not allow reassigning work orders' },
          { status: 403 }
        )
      }
    }

    if (data.status === 'COMPLETED' && existingWo.status !== 'COMPLETED') {
      const completionAccess = await canCompleteWorkOrder(user, id)
      if (!completionAccess.allowed) {
        return NextResponse.json({ error: completionAccess.reason }, { status: 403 })
      }
      const incompleteRequired = await prisma.subtask.count({
        where: { workOrderId: id, status: { not: 'COMPLETED' }, required: true },
      })
      if (incompleteRequired > 0) {
        return NextResponse.json(
          { error: `Cannot complete: ${incompleteRequired} required subtask(s) still incomplete` },
          { status: 422 }
        )
      }
    }

    // Validate the status transition, mirroring the status route.
    // Skipped when the status is unchanged (idempotent re-save).
    if (data.status && data.status !== existingWo.status) {
      if (!isValidWOStatusTransition(existingWo.status, data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existingWo.status} to ${data.status}` },
          { status: 422 }
        )
      }
    }

    // Unlock: CLOSED → COMPLETED — Admin only, reason required (same as status route)
    if (data.status === 'COMPLETED' && existingWo.status === 'CLOSED') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only admins can unlock closed work orders' }, { status: 403 })
      }
      if (!data.notes || !data.notes.trim()) {
        return NextResponse.json({ error: 'Unlock reason is required' }, { status: 400 })
      }
    }

    // Block edits on CLOSED work orders
    if (existingWo.status === 'CLOSED' && !isManagerOrAbove(user)) {
      return NextResponse.json(
        { error: 'Closed work orders cannot be edited' },
        { status: 403 }
      )
    }

    // ── Auto-timestamps ───────────────────────────────────────────────
    const extra: Record<string, unknown> = {}
    if (data.status === 'IN_PROGRESS' && !existingWo.startedAt) extra.startedAt = new Date()
    if (data.status === 'IN_PROGRESS' && !existingWo.respondedAt) extra.respondedAt = new Date()
    if (data.status === 'COMPLETED' && existingWo.status !== 'COMPLETED') {
      extra.completedAt = new Date()
      extra.completedById = user.userId
      extra.completionType = getCompletionType(user, isManagerOrAbove(user))
      if (existingWo.status === 'CLOSED') {
        extra.completedAt = existingWo.completedAt
        extra.closedAt = null
      }
    }

    // ── Mutual exclusion: team vs individual ──────────────────────────
    if (data.teamId) {
      data.assignedToId = null
    }
    if (data.assignedToId) {
      data.teamId = null
    }

    // ── Auto-derive domainId from team ───────────────────────────────
    let derivedDomainId: string | null = null
    if (data.teamId) {
      const teamDomain = await prisma.teamDomain.findFirst({
        where: { teamId: data.teamId },
        include: { domain: true },
      })
      derivedDomainId = teamDomain?.domainId ?? null
    }

    // ── Normalize asset scope ─────────────────────────────────────────
    const normalized = await normalizeWorkOrderAssets(
      data.assetId !== undefined ? data.assetId : existingWo.assetId,
      data.selectedAssetIds,
      data.locationId !== undefined ? data.locationId : existingWo.locationId,
      data.locationScope !== undefined ? data.locationScope : existingWo.locationScope,
    )

    // ── Derive WO location from primary asset when not explicitly set ─
    let derivedLocationId: string | null | undefined
    if (data.locationId !== undefined) {
      derivedLocationId = data.locationId
    } else if (normalized.entries.length > 0) {
      const primaryAssetId = normalized.assetId ?? normalized.entries[0].assetId
      const primaryAsset = await prisma.asset.findUnique({
        where: { id: primaryAssetId },
        select: { locationId: true },
      })
      derivedLocationId = primaryAsset?.locationId ?? existingWo.locationId
    }

    const existingAssetIds = existingWo.assets.map(a => a.assetId)
    const incomingAssetIds = normalized.entries.map(e => e.assetId)

    const assetIdsChanged =
      existingAssetIds.length !== incomingAssetIds.length ||
      !existingAssetIds.every((id, i) => id === incomingAssetIds[i])

    // ── Plant scope enforcement (only for fields actually changed) ────
    const changedLocationIds: (string | null | undefined)[] = []
    if (data.locationId !== undefined) changedLocationIds.push(derivedLocationId)

    const inScope =
      (await canWriteToLocations(user, changedLocationIds)) &&
      (assetIdsChanged ? await canWriteToAssets(user, incomingAssetIds) : true) &&
      (data.assignedToId !== undefined ? await canAssignUsers(user, [data.assignedToId]) : true) &&
      (data.teamId !== undefined ? await canAssignTeams(user, [data.teamId]) : true) &&
      (data.teamId !== undefined ? await canWriteToTeams(user, [data.teamId]) : true)
    if (!inScope) {
      return NextResponse.json(
        { error: 'You do not have access to the selected location, asset, or assignee' },
        { status: 403 }
      )
    }

    // ── Sync WorkOrderAsset rows ──────────────────────────────────────
    await syncWorkOrderAssets(id, normalized.entries)

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

    // ── Update the WorkOrder record ───────────────────────────────────
    const updateData = {
      ...Object.fromEntries(
        Object.entries(data).filter(([key]) =>
          ['title','description','type','priority','status','assetId','locationId',
           'locationScope','assignedToId','teamId','laborHours','laborCost',
           'partsCost','notes','customFields','issueId','customIssue','startDate',
           'woCategoryId','downtimeStartedAt','downtimeEndedAt'].includes(key)
        )
      ),
      ...(data.teamId ? { domainId: derivedDomainId } : {}),
      ...(derivedLocationId !== undefined ? { locationId: derivedLocationId } : {}),
      ...extra,
      ...(!isAdmin(user) ? {} : data.shift !== undefined ? { shift: data.shift } : {}),
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      downtimeStartedAt: data.downtimeStartedAt !== undefined
        ? (data.downtimeStartedAt ? new Date(data.downtimeStartedAt) : null)
        : undefined,
      downtimeEndedAt: data.downtimeEndedAt !== undefined
        ? (data.downtimeEndedAt ? new Date(data.downtimeEndedAt) : null)
        : undefined,
      assetId: normalized.assetId, // use normalized single-asset display value
    }

    const wo = await prisma.workOrder.update({
      where: { id },
      data: updateData,
      include: {
        domain: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
      },
    })

    if (data.status && data.status !== existingWo.status) {
      await prisma.workOrderStatusHistory.create({
        data: {
          workOrderId:   id,
          status:        wo.status,
          changedById:   user.userId,
          changedByName: user.name,
          notes:         `Status changed from ${existingWo.status} to ${wo.status} during work order update`,
        }
      })
      notificationEmitter.emit(`activity:${id}`)
    }

    // ── Update asset metrics on completion ────────────────────────────
    if (data.status === 'COMPLETED') {
      try {
        await updateWorkOrderLinkedAssetMetrics(id)
      } catch (err) {
        console.error('Failed to update asset metrics:', err)
      }
    }

    // ── Update asset status ──────────────────────────────────────────
    if (wo.assetId) {
      if (data.status === 'IN_PROGRESS') {
        await prisma.asset.update({
          where: { id: wo.assetId },
          data: { status: 'UNDER_MAINTENANCE' },
        })
      } else if (data.status === 'COMPLETED' || data.status === 'CANCELLED' || data.status === 'CLOSED') {
        await prisma.asset.update({
          where: { id: wo.assetId },
          data: { status: 'ACTIVE' },
        })
      }
    }

    // ── Audit trail ──────────────────────────────────────────────────
    const changes: Record<string, { before: unknown; after: unknown }> = {}
    const fieldsToTrack = [...Object.keys(data), 'startedAt', 'completedAt', 'completedById', 'respondedAt']
    for (const key of fieldsToTrack) {
      if (key in existingWo && key in wo) {
        const beforeVal = existingWo[key as keyof typeof existingWo]
        const afterVal = wo[key as keyof typeof wo]
        const beforeStr = beforeVal instanceof Date ? beforeVal.toISOString() : JSON.stringify(beforeVal)
        const afterStr = afterVal instanceof Date ? afterVal.toISOString() : JSON.stringify(afterVal)
        if (beforeStr !== afterStr) {
          changes[key] = {
            before: beforeVal instanceof Date ? beforeVal.toISOString() : beforeVal,
            after: afterVal instanceof Date ? afterVal.toISOString() : afterVal,
          }
        }
      }
    }

    await writeAudit({
      action: 'UPDATE',
      entity: 'Work Order',
      entityId: wo.id,
      entityName: wo.title,
      changes,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    if (Object.keys(changes).length > 0) {
      notificationEmitter.emit(`activity:${wo.id}`)
    }

    return NextResponse.json(wo)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update work order' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'wo:delete'))) {
      return NextResponse.json({ error: 'Only admins can delete work orders' }, { status: 403 })
    }
    const { id } = await params
    const wo = await prisma.workOrder.findUnique({
      where: { id },
      select: {
        title: true,
        assetId: true,
        teamId: true,
        attachments: true,
        assets: { select: { assetId: true } },

      }
    })
    if (!wo) return NextResponse.json({ error: 'Work order not found' }, { status: 404 })

    // Scope enforcement: only users who can view this WO and (for scoped
    // users) whose team scope contains the WO's team may delete it.
    const viewAccess = await canViewWorkOrder(user, id)
    if (!viewAccess.allowed) {
      return NextResponse.json({ error: viewAccess.reason }, { status: 403 })
    }
    if (!(await canAccessTeamScope(user, wo.teamId))) {
      return NextResponse.json({ error: 'You do not have access to this work order' }, { status: 403 })
    }

    // ── Cleanup Storage (MinIO / Local) ───────────────────────────────
    // 1. Top-level attachments
    for (const at of wo.attachments) {
      const url = at.url
      // Extract key if not stored directly as field (attachments table should have key)
      // I'll need to check if attachment table has key. 
      // If not, I'll extract it from the URL.
      let objectKey: string | null = (at as { key?: string }).key || null
      if (!objectKey && at.url.includes('?')) {
        const urlObj = new URL(at.url)
        objectKey = decodeURIComponent(urlObj.pathname.replace(/^\//, '').split('/').slice(1).join('/'))
      }
      await cleanupFile(at.url, objectKey)
    }

    await prisma.workOrderPart.deleteMany({ where: { workOrderId: id } })
    await prisma.workOrder.delete({ where: { id } })

    // Recalculate metrics for all assets that were linked to this WO
    const linkedAssetIds = new Set<string>()
    if (wo.assetId) linkedAssetIds.add(wo.assetId)
    for (const a of wo.assets) linkedAssetIds.add(a.assetId)
    for (const assetId of linkedAssetIds) {
      try {
        await updateAssetMetrics(assetId)
      } catch (err) {
        console.error('Failed to update asset metrics after WO delete:', err)
      }
    }

    await writeAudit({
      action: 'DELETE',
      entity: 'Work Order',
      entityId: id,
      entityName: wo.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete work order' }, { status: 500 })
  }
}
