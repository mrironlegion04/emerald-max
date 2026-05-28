import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { writeAudit } from '@/lib/audit'
import { sendWOAssigned } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { z } from 'zod'
import {
  normalizeWorkOrderAssets,
  syncWorkOrderAssets,
  resolveTemplatesForAssets,
  generatePerAssetChecklists,
} from '@/lib/work-order-assets'

const woSchema = z.object({
  title:               z.string().min(1, 'Title is required'),
  description:         z.string().nullable().optional(),
  type:                z.enum(['BREAKDOWN','PREVENTIVE','PREDICTIVE']).default('BREAKDOWN'),
  priority:            z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  status:              z.enum(['OPEN','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED']).default('OPEN'),
  dueDate:             z.string().nullable().optional(),
  assetId:             z.string().nullable().optional(),
  locationId:          z.string().nullable().optional(),
  locationScope:       z.enum(['ALL_ASSETS', 'GENERAL']).nullable().optional(),
  selectedAssetIds:    z.array(z.string()).optional().default([]),
  assignedToId:        z.string().nullable().optional(),
  teamId:              z.string().nullable().optional(),
  laborHours:          z.number().nullable().optional(),
  laborCost:           z.number().nullable().optional(),
  partsCost:           z.number().nullable().optional(),
  notes:               z.string().nullable().optional(),
  issueId:             z.string().nullable().optional(),
  customIssue:         z.string().nullable().optional(),
  checklistTemplateIds: z.array(z.string()).optional().default([]),
}).refine(
  data => !(data.issueId && data.customIssue),
  { message: 'Provide either a standard issue or custom description, not both' }
)

async function generateWONumber(): Promise<string> {
  const last = await prisma.workOrder.findFirst({
    orderBy: { woNumber: 'desc' },
    select:  { woNumber: true },
  })
  let next = 1
  if (last?.woNumber) {
    const num = parseInt(last.woNumber.replace('WO-', ''), 10)
    if (!isNaN(num)) next = num + 1
  }
  return `WO-${String(next).padStart(4, '0')}`
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const whereClause = user.role === 'ADMIN' || user.role === 'MANAGER'
      ? {}
      : {
          OR: [
            { assignedToId: user.userId },
            { team: { members: { some: { userId: user.userId } } } },
          ],
        }

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

    const body = await request.json()
    const data = woSchema.parse(body)

    if (data.customIssue) {
      data.customIssue = data.customIssue.trim()
      if (data.customIssue.length === 0) data.customIssue = null
    }

    const woNumber = await generateWONumber()

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } })
    if (!dbUser) {
      return NextResponse.json({ error: 'User session invalid. Please log in again.' }, { status: 401 })
    }

    // ── Normalize asset scope ────────────────────────────────────────
    const normalized = await normalizeWorkOrderAssets(
      data.assetId,
      data.selectedAssetIds,
      data.locationId,
      data.locationScope,
    )

    const wo = await prisma.workOrder.create({
      data: {
        woNumber,
        title:          data.title,
        description:    data.description  ?? null,
        type:           data.type,
        priority:       data.priority,
        status:         data.status,
        dueDate:        data.dueDate      ? new Date(data.dueDate) : null,
        assetId:        normalized.assetId,
        locationId:     data.locationId   ?? null,
        locationScope:  data.locationScope ?? null,
        assignedToId:   data.assignedToId ?? null,
        teamId:         data.teamId       ?? null,
        createdById:    user.userId,
        laborHours:     data.laborHours   ?? null,
        laborCost:      data.laborCost    ?? null,
        partsCost:      data.partsCost    ?? null,
        notes:          data.notes        ?? null,
        issueId:        data.issueId      ?? null,
        customIssue:    data.customIssue  ?? null,
        startedAt:      data.status === 'IN_PROGRESS' ? new Date() : null,
        completedAt:    data.status === 'COMPLETED'   ? new Date() : null,
      },
    })

    // ── Sync WorkOrderAsset rows (freezes the scope at creation) ─────
    if (normalized.entries.length > 0) {
      await syncWorkOrderAssets(wo.id, normalized.entries)
    }

    // ── Generate per-asset checklists from auto-resolved templates ───
    const assetIds = normalized.entries.map(e => e.assetId)
    if (assetIds.length > 0) {
      const templateMappings = await resolveTemplatesForAssets(assetIds, data.locationId)
      await generatePerAssetChecklists(wo.id, templateMappings)
    }

    // ── Snapshot user-selected checklist templates ───────────────────
    if (data.checklistTemplateIds && data.checklistTemplateIds.length > 0) {
      const selectedTemplates = await prisma.checklistTemplate.findMany({
        where: { id: { in: data.checklistTemplateIds } },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      })

      // Apply each selected template to every asset in scope
      const selectedMappings: { templateId: string; assetId: string; source: string }[] = []
      for (const tid of data.checklistTemplateIds) {
        for (const aid of assetIds.length > 0 ? assetIds : [null]) {
          if (aid) selectedMappings.push({ templateId: tid, assetId: aid, source: 'MANUAL' })
        }
      }
      // For location-general WOs with no assets, create a single checklist
      if (assetIds.length === 0 && normalized.scope === 'LOCATION_GENERAL') {
        for (const template of selectedTemplates) {
          if (template.items.length === 0) continue
          await prisma.wOChecklist.create({
            data: {
              workOrderId: wo.id,
              title: template.name,
              items: {
                create: template.items.map(item => ({
                  label: item.label,
                  type: item.type,
                  isMandatory: item.isMandatory,
                  sortOrder: item.sortOrder,
                  options: item.options,
                  isChecked: false,
                })),
              },
            },
          })
        }
      } else {
        await generatePerAssetChecklists(wo.id, selectedMappings)
      }
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
        await createNotification({
          userId: member.user.id,
          title: `WO ${wo.woNumber} Assigned to Your Team`,
          message: wo.title, type: 'WORK_ORDER_ASSIGNED',
          entityId: wo.id, href: `/work-orders/${wo.id}`,
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
