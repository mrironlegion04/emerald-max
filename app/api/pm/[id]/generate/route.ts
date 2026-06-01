import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import {
  resolveProceduresForAssets,
  generatePerAssetProcedures
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
        procedures: {
          select: { procedure: { select: { id: true, name: true } } },
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

    // Generate checklists if ALL_ASSETS location scope
    if (schedule.locationId && schedule.locationScope === 'ALL_ASSETS') {
      const allLocations = await prisma.location.findMany({
        select: { id: true, parentId: true },
      })

      function getDescendantLocationIds(locId: string): string[] {
        const ids = [locId]
        const children = allLocations.filter(l => l.parentId === locId)
        for (const child of children) {
          ids.push(...getDescendantLocationIds(child.id))
        }
        return ids
      }

      const allLocationIds = getDescendantLocationIds(schedule.locationId)

      const allAssets = await prisma.asset.findMany({
        select: { id: true, name: true, parentId: true, locationId: true },
      })

      const locationSeedAssets = allAssets.filter(a => a.locationId && allLocationIds.includes(a.locationId))
      const seedIds = new Set(locationSeedAssets.map(a => a.id))

      const topLevelParents = locationSeedAssets.filter(a => !a.parentId || !seedIds.has(a.parentId))

      const tracedAssets: { id: string; name: string }[] = []
      const visited = new Set<string>()

      function traceDescendants(asset: typeof allAssets[0]) {
        if (visited.has(asset.id)) return
        visited.add(asset.id)
        tracedAssets.push({ id: asset.id, name: asset.name })

        const children = allAssets.filter(a => a.parentId === asset.id)
        children.sort((a, b) => a.name.localeCompare(b.name))
        for (const child of children) {
          traceDescendants(child)
        }
      }

      topLevelParents.sort((a, b) => a.name.localeCompare(b.name))
      for (const parent of topLevelParents) {
        traceDescendants(parent)
      }

      if (tracedAssets.length > 0) {
        const woProcedure = await prisma.wOProcedure.create({
          data: {
            workOrderId: wo.id,
            title: 'Location Assets Procedure',
            source: 'PM',
          },
        })

        await prisma.wOProcedureStep.createMany({
          data: tracedAssets.map((asset, index) => ({
            procedureId: woProcedure.id,
            label: `Check ${asset.name}`,
            assetId: asset.id,
            isChecked: false,
            sortOrder: index,
          })),
        })
      }
    } else if (schedule.procedures && schedule.procedures.length > 0) {
      // Propagate PM procedures
      for (const sp of schedule.procedures) {
        const steps = await prisma.procedureStep.findMany({
          where: { procedureId: sp.procedure.id },
          orderBy: { sortOrder: 'asc' },
        })

        if (steps.length > 0) {
          const woProcedure = await prisma.wOProcedure.create({
            data: {
              workOrderId: wo.id,
              procedureId: sp.procedure.id,
              title: sp.procedure.name,
              source: 'PM',
            },
          })

          await prisma.wOProcedureStep.createMany({
            data: steps.map(step => ({
              procedureId: woProcedure.id,
              label: step.label,
              type: step.type,
              isMandatory: step.isMandatory,
              sortOrder: step.sortOrder,
              options: step.options,
              isChecked: false,
              settings: step.settings ?? {},
              logic: step.logic ?? {},
            })),
          })
        }
      }
    }

    // Also run auto-resolution for assets, category, and location in addition to PM procedures
    if (schedule.assetId) {
      const resolvedProcedures = await resolveProceduresForAssets([schedule.assetId], schedule.locationId)
      await generatePerAssetProcedures(wo.id, resolvedProcedures, 'AUTO')
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
