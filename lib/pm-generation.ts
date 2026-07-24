import { prisma } from '@/lib/db'
import {
  resolveProceduresForAssets,
  generatePerAssetProcedures
} from '@/lib/work-order-assets'

// ── Types ──────────────────────────────────────────────────────────────

interface NestedPMConfig {
  label: string
  frequency: string
  interval: number
  runEvery: number
  enabled: boolean
}

interface Tier {
  label: string
  frequency: string
  interval: number
}

interface GenerationResult {
  workOrderIds: string[]
  woNumbers: string[]
  skipped: number
  errors: string[]
}

// ── Date Utilities (with month-overflow fix) ────────────────────────────

export function advanceDate(current: Date, frequency: string, interval: number): Date {
  const next = new Date(current)
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + interval)
      break
    case 'WEEKLY':
      next.setDate(next.getDate() + interval * 7)
      break
    case 'MONTHLY': {
      const targetMonth = next.getMonth() + interval
      const targetYear = next.getFullYear() + Math.floor(targetMonth / 12)
      const monthInYear = ((targetMonth % 12) + 12) % 12
      const lastDay = new Date(targetYear, monthInYear + 1, 0).getDate()
      next.setDate(Math.min(next.getDate(), lastDay))
      next.setMonth(monthInYear)
      next.setFullYear(targetYear)
      break
    }
    case 'QUARTERLY': {
      const targetMonth = next.getMonth() + interval * 3
      const targetYear = next.getFullYear() + Math.floor(targetMonth / 12)
      const monthInYear = ((targetMonth % 12) + 12) % 12
      const lastDay = new Date(targetYear, monthInYear + 1, 0).getDate()
      next.setDate(Math.min(next.getDate(), lastDay))
      next.setMonth(monthInYear)
      next.setFullYear(targetYear)
      break
    }
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + interval)
      break
    default:
      next.setMonth(next.getMonth() + interval)
  }
  return next
}

// ── WO Number Generation (with retry for uniqueness) ───────────────────

async function generateWONumber(retries = 5, client?: { workOrder: typeof prisma.workOrder }): Promise<string> {
  const c = client ?? prisma
  for (let attempt = 0; attempt < retries; attempt++) {
    const last = await c.workOrder.findFirst({
      orderBy: { woNumber: 'desc' },
      select: { woNumber: true },
    })
    let next = 1
    if (last?.woNumber) {
      const num = parseInt(last.woNumber.replace('WO-', ''), 10)
      if (!isNaN(num)) next = num + 1
    }
    const candidate = `WO-${String(next).padStart(4, '0')}`
    const exists = await c.workOrder.findUnique({
      where: { woNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
  }
  throw new Error('Failed to generate unique WO number after retries')
}

// ── Tier Builder ───────────────────────────────────────────────────────

function buildTiers(schedule: {
  frequency: string
  interval: number
  nestedConfig: unknown
  nestedCounter: number
}): Tier[] {
  const tiers: Tier[] = []

  // Base tier (the schedule itself)
  tiers.push({
    label: '',
    frequency: schedule.frequency,
    interval: schedule.interval,
  })

  // Nested tiers
  if (schedule.nestedConfig && Array.isArray(schedule.nestedConfig)) {
    const counter = schedule.nestedCounter
    for (const nested of schedule.nestedConfig as NestedPMConfig[]) {
      if (!nested.enabled) continue
      const runEvery = nested.runEvery ?? 1
      const shouldFire = counter % runEvery === 0
      if (shouldFire) {
        tiers.push({
          label: nested.label,
          frequency: nested.frequency,
          interval: nested.interval,
        })
      }
    }
  }

  return tiers
}

// ── Procedure Propagation ──────────────────────────────────────────────

async function propagateProcedures(
  schedule: {
    id: string
    assetId: string | null
    locationId: string | null
    locationScope: string | null
    procedures: { procedure: { id: string; name: string } }[]
  },
  workOrderId: string,
) {
  // Handle ALL_ASSETS location scope
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

    const locationSeedAssets = allAssets.filter(
      a => a.locationId && allLocationIds.includes(a.locationId)
    )
    const seedIds = new Set(locationSeedAssets.map(a => a.id))
    const topLevelParents = locationSeedAssets.filter(
      a => !a.parentId || !seedIds.has(a.parentId)
    )

    const tracedAssets: { id: string; name: string }[] = []
    const visited = new Set<string>()

    function traceDescendants(asset: (typeof allAssets)[0]) {
      if (visited.has(asset.id)) return
      visited.add(asset.id)
      tracedAssets.push({ id: asset.id, name: asset.name })
      const children = allAssets
        .filter(a => a.parentId === asset.id)
        .sort((a, b) => a.name.localeCompare(b.name))
      for (const child of children) traceDescendants(child)
    }

    topLevelParents.sort((a, b) => a.name.localeCompare(b.name))
    for (const parent of topLevelParents) traceDescendants(parent)

    if (tracedAssets.length > 0) {
      const woProcedure = await prisma.wOProcedure.create({
        data: {
          workOrderId,
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
  }

  // Propagate PM-attached procedures
  if (schedule.procedures && schedule.procedures.length > 0) {
    for (const sp of schedule.procedures) {
      const steps = await prisma.procedureStep.findMany({
        where: { procedureId: sp.procedure.id },
        orderBy: { sortOrder: 'asc' },
      })

      if (steps.length > 0) {
        const woProcedure = await prisma.wOProcedure.create({
          data: {
            workOrderId,
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

  // Auto-resolve asset/category/location procedures
  if (schedule.assetId) {
    const resolved = await resolveProceduresForAssets(
      [schedule.assetId],
      schedule.locationId,
    )
    await generatePerAssetProcedures(workOrderId, resolved, 'AUTO')
  }
}

// ── Core Generation Function ───────────────────────────────────────────

export async function generateWOsForSchedule(
  scheduleId: string,
  options?: { userId?: string; maxWOs?: number; horizon?: number },
): Promise<GenerationResult> {
  const result: GenerationResult = {
    workOrderIds: [],
    woNumbers: [],
    skipped: 0,
    errors: [],
  }

  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      asset: {
        select: {
          id: true,
          name: true,
          currentMeterValue: true,
          categoryId: true,
          locationId: true,
        },
      },
      location: { select: { id: true, name: true } },
      procedures: {
        select: {
          procedure: { select: { id: true, name: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })

  if (!schedule) {
    result.errors.push('Schedule not found')
    return result
  }
  if (!schedule.isActive) {
    result.errors.push('Schedule is inactive')
    return result
  }

  // Duplicate check for asset-based schedules
  if (schedule.assetId) {
    const existingWO = await prisma.workOrder.findFirst({
      where: {
        assetId: schedule.assetId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL'] },
        type: 'PREVENTIVE',
      },
      select: { woNumber: true },
    })
    if (existingWO) {
      result.errors.push(`Active WO already exists: ${existingWO.woNumber}`)
      return result
    }
  }

  // Meter threshold check (skip for TIME_OR_METER — either trigger can fire)
  if (schedule.triggerType === 'METER') {
    if (!schedule.meterInterval) {
      result.errors.push('Meter interval not set')
      return result
    }
    if (
      !schedule.asset?.currentMeterValue ||
      schedule.asset.currentMeterValue < schedule.meterInterval
    ) {
      result.errors.push('Meter value below threshold')
      return result
    }
  }

  // Determine how many horizon batches to generate
  const horizon = options?.horizon ?? schedule.schedulingHorizon ?? 1
  const baseCounter = (schedule.nestedCounter ?? 0) + (schedule.nestedStartIndex ?? 0)

  // Generate WOs in a transaction
  const generated = await prisma.$transaction(async tx => {
    const woIds: string[] = []
    const woNumbers: string[] = []
    let currentCounter = schedule.nestedCounter ?? 0

    for (let batch = 0; batch < horizon; batch++) {
      // Build tiers for this batch's counter value
      const tiers = buildTiers({
        ...schedule,
        nestedCounter: baseCounter + batch,
      })

      const tiersToGenerate = options?.maxWOs
        ? tiers.slice(0, options.maxWOs)
        : tiers

      for (let i = 0; i < tiersToGenerate.length; i++) {
        const tier = tiersToGenerate[i]
        const woNumber = await generateWONumber(5, tx)

        // Build title
        let woTitle = schedule.title
        if (tier.label) woTitle += ` — ${tier.label}`
        if (schedule.asset) woTitle += ` — ${schedule.asset.name}`
        else if (schedule.location) woTitle += ` — ${schedule.location.name}`

        // Calculate due date (advance by batch * interval from base date)
        let dueDate: Date
        if (schedule.triggerType === 'METER') {
          dueDate = new Date()
        } else {
          const baseDate = new Date(schedule.nextDueDate)
          dueDate = batch === 0
            ? baseDate
            : advanceDate(baseDate, schedule.frequency, schedule.interval * batch)
        }

        // Calculate start date from offset
        const startDate = (schedule.startDateOffset ?? 0) > 0
          ? new Date(dueDate.getTime() - (schedule.startDateOffset ?? 0) * 86400000)
          : undefined

        // Build description with template
        let woDescription = schedule.description ?? undefined
        if (schedule.woDescription) {
          woDescription = woDescription
            ? `${woDescription}\n\n${schedule.woDescription}`
            : schedule.woDescription
        }

        const wo = await tx.workOrder.create({
          data: {
            woNumber,
            title: woTitle,
            description: woDescription,
            type: 'PREVENTIVE',
            status: 'OPEN',
            priority: schedule.woPriority ?? 'MEDIUM',
            dueDate,
            ...(startDate ? { startDate } : {}),
            assetId: schedule.assetId,
            locationId: schedule.locationId,
            locationScope: schedule.locationScope,
            maintenanceScheduleId: schedule.id,
            createdById: options?.userId ?? null,
            assignedToId: schedule.woAssignedToId ?? null,
            nestedLevel: i,
            nestedLabel: tier.label || null,
          },
        })

        // Create initial status history
        await tx.workOrderStatusHistory.create({
          data: {
            workOrderId: wo.id,
            status: 'OPEN',
            changedById: options?.userId ?? null,
            changedByName: options?.userId ? 'User' : 'System',
            notes: 'Generated from PM schedule',
          },
        })

        woIds.push(wo.id)
        woNumbers.push(woNumber)
      }

      currentCounter++
    }

    // Advance nextDueDate (for fixed intervals, advance from current due date)
    let nextDue: Date | null = null
    if (schedule.triggerType === 'TIME' && schedule.scheduleBehavior === 'FIXED') {
      nextDue = advanceDate(
        new Date(schedule.nextDueDate),
        schedule.frequency,
        schedule.interval * horizon,
      )
    }
    // For FLOATING: nextDue is advanced when the WO is completed (handled in handleWOCompletion)
    // For METER: don't advance the date
    // For TIME_OR_METER with fixed: advance by horizon batches

    await tx.maintenanceSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(nextDue ? { nextDueDate: nextDue } : {}),
        nestedCounter: currentCounter,
        ...(schedule.triggerType === 'METER' && schedule.asset?.currentMeterValue
          ? { lastTriggeredValue: schedule.asset.currentMeterValue }
          : {}),
      },
    })

    return { woIds, woNumbers }
  })

  // Post-transaction: propagate procedures to each WO
  for (const woId of generated.woIds) {
    try {
      await propagateProcedures(schedule, woId)
    } catch (err) {
      console.error(`Failed to propagate procedures for WO ${woId}:`, err)
    }
  }

  result.workOrderIds = generated.woIds
  result.woNumbers = generated.woNumbers
  return result
}

// ── Floating Interval Handler ──────────────────────────────────────────

export async function handleWOCompletion(workOrderId: string) {
  const wo = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { maintenanceScheduleId: true },
  })
  if (!wo?.maintenanceScheduleId) return

  const schedule = await prisma.maintenanceSchedule.findUnique({
    where: { id: wo.maintenanceScheduleId },
    select: {
      scheduleBehavior: true,
      frequency: true,
      interval: true,
      nextDueDate: true,
    },
  })
  if (!schedule || schedule.scheduleBehavior !== 'FLOATING') return

  // Reschedule from completion date
  const completedAt = new Date()
  const nextDue = advanceDate(completedAt, schedule.frequency, schedule.interval)

  await prisma.maintenanceSchedule.update({
    where: { id: wo.maintenanceScheduleId },
    data: {
      lastCompletedAt: completedAt,
      nextDueDate: nextDue,
    },
  })
}
