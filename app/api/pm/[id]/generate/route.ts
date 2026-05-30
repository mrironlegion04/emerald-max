import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import {
  normalizeWorkOrderAssets,
  syncWorkOrderAssets,
  generateAutoChecklistsForWorkOrder,
} from '@/lib/work-order-assets'

// Calculate the next due date based on frequency and interval
function advanceDate(current: Date, frequency: string, interval: number): Date {
  const next = new Date(current)
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + interval)
      break
    case 'WEEKLY':
      next.setDate(next.getDate() + interval * 7)
      break
    case 'MONTHLY':
      next.setMonth(next.getMonth() + interval)
      break
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + interval * 3)
      break
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + interval)
      break
    default:
      next.setMonth(next.getMonth() + interval)
  }
  return next
}

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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'TECHNICIAN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        asset: { select: { id: true, name: true, currentMeterValue: true } },
        location: { select: { id: true, name: true } },
        checklistTemplates: {
          select: { template: { select: { id: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    if (!schedule.isActive) return NextResponse.json({ error: 'Schedule is inactive' }, { status: 422 })

    // Check for duplicate: existing OPEN or IN_PROGRESS WO for this asset
    if (schedule.assetId) {
      const existingWO = await prisma.workOrder.findFirst({
        where: {
          assetId: schedule.assetId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          type: 'PREVENTIVE',
        },
        select: { woNumber: true },
      })
      if (existingWO) {
        return NextResponse.json(
          { error: `Active WO already exists: ${existingWO.woNumber}` },
          { status: 422 }
        )
      }
    }

    // For METER-based triggers, check if currentMeterValue >= meterInterval
    if (schedule.triggerType === 'METER') {
      if (!schedule.meterInterval) {
        return NextResponse.json({ error: 'Meter interval not set' }, { status: 422 })
      }
      if (!schedule.asset || !schedule.asset.currentMeterValue || schedule.asset.currentMeterValue < schedule.meterInterval) {
        return NextResponse.json(
          {
            error: `Current meter value (${schedule.asset?.currentMeterValue ?? 0}) is below threshold (${schedule.meterInterval})`
          },
          { status: 422 }
        )
      }
    }

    const woNumber = await generateWONumber()
    const nextDue =
      schedule.triggerType === 'TIME'
        ? advanceDate(new Date(schedule.nextDueDate), schedule.frequency, schedule.interval)
        : schedule.nextDueDate // For METER triggers, don't auto-advance

    // Determine safe Work Order title
    let woTitle = schedule.title
    if (schedule.asset) {
      woTitle = `${schedule.title} — ${schedule.asset.name}`
    } else if (schedule.location) {
      woTitle = `${schedule.title} — ${schedule.location.name}`
    }

    // Create WO and update schedule atomically
    const [wo] = await prisma.$transaction([
      prisma.workOrder.create({
        data: {
          woNumber,
          title: woTitle,
          description: schedule.description ?? undefined,
          type: 'PREVENTIVE',
          status: 'OPEN',
          priority: 'MEDIUM',
          dueDate: schedule.triggerType === 'TIME' ? new Date(schedule.nextDueDate) : new Date(),
          assetId: schedule.assetId,
          locationId: schedule.locationId,
          locationScope: schedule.locationScope,
          maintenanceScheduleId: schedule.id,
          createdById: user.userId,
        },
      }),
      prisma.maintenanceSchedule.update({
        where: { id },
        data: { nextDueDate: nextDue },
      }),
    ])

    // Normalize and sync WorkOrderAsset rows (freezes the scope)
    const normalized = await normalizeWorkOrderAssets(
      schedule.assetId,
      [],
      schedule.locationId,
      schedule.locationScope,
    )
    if (normalized.entries.length > 0) {
      await syncWorkOrderAssets(wo.id, normalized.entries)
    }

    // Generate checklists only if location scope is not GENERAL
    if (schedule.locationScope !== 'GENERAL') {
      const assetIds = normalized.entries.map(e => e.assetId)
      if (assetIds.length > 0) {
        await generateAutoChecklistsForWorkOrder(wo.id, assetIds, schedule.locationScope)
      }

      // Propagate PM-level template shortcuts if direct templates are assigned to the PM schedule
      if (schedule.checklistTemplates && schedule.checklistTemplates.length > 0) {
        // Apply each PM checklist template to every asset in scope
        for (const ctItem of schedule.checklistTemplates) {
          const templateItems = await prisma.checklistTemplateItem.findMany({
            where: { templateId: ctItem.template.id },
            orderBy: { sortOrder: 'asc' },
          })

          if (templateItems.length > 0) {
            for (const aid of assetIds.length > 0 ? assetIds : [null]) {
              const prefix = aid ? `${(await prisma.asset.findUnique({ where: { id: aid }, select: { name: true } }))?.name} — ` : ''
              const checklist = await prisma.wOChecklist.create({
                data: {
                  workOrderId: wo.id,
                  title: `${prefix}${ctItem.template.name}`,
                },
              })

              await prisma.wOChecklistItem.createMany({
                data: templateItems.map(item => ({
                  checklistId: checklist.id,
                  label: item.label,
                  type: item.type,
                  isMandatory: item.isMandatory,
                  sortOrder: item.sortOrder,
                  options: item.options,
                  isChecked: false,
                  assetId: aid,
                })),
              })
            }
          }
        }
      }
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        action: 'GENERATE',
        entity: 'Work Order',
        entityId: wo.id,
        entityName: wo.title,
        userId: user.userId,
        userName: user.name,
        userEmail: user.email,
        changes: `Generated from PM Schedule: ${schedule.title}`,
      },
    })

    return NextResponse.json(wo, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to generate work order' }, { status: 500 })
  }
}
