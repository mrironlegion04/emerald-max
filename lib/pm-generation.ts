import { prisma } from '@/lib/db'
import { generateWONumber } from '@/lib/wo-number'

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
      assets: {
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
        },
      },
      location: { select: { id: true, name: true } },
      tasks: { orderBy: { order: 'asc' as const } },
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

  // Resolve target assets: junction rows win, fall back to the legacy single assetId
  const targetAssets = schedule.assets.length > 0
    ? schedule.assets.map(a => a.asset)
    : (schedule.asset ? [schedule.asset] : [])

  // Per-asset duplicate + meter threshold checks (asset-based schedules only)
  const skippedAssets = new Set<string>()
  if (targetAssets.length > 0) {
    for (const asset of targetAssets) {
      const existingWO = await prisma.workOrder.findFirst({
        where: {
          assetId: asset.id,
          status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL'] },
          type: 'PREVENTIVE',
        },
        select: { woNumber: true },
      })
      if (existingWO) {
        skippedAssets.add(asset.id)
        result.errors.push(`Active WO already exists for ${asset.name}: ${existingWO.woNumber}`)
        continue
      }

      if (schedule.triggerType === 'METER' && schedule.meterInterval) {
        if (
          !asset.currentMeterValue ||
          asset.currentMeterValue < schedule.meterInterval
        ) {
          skippedAssets.add(asset.id)
          result.errors.push(`${asset.name}: meter value below threshold`)
        }
      }
    }

    if (skippedAssets.size === targetAssets.length) {
      result.errors = result.errors.length > 0 ? [result.errors[0]] : result.errors
      return result
    }
  }

  // Meter threshold check for schedules with no asset target
  if (schedule.triggerType === 'METER' && targetAssets.length === 0) {
    if (!schedule.meterInterval) {
      result.errors.push('Meter interval not set')
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
    const eligibleAssets = targetAssets.filter(a => !skippedAssets.has(a.id))
    const targets: (typeof eligibleAssets[number] | null)[] =
      eligibleAssets.length > 0 ? eligibleAssets : [null]

    for (const asset of targets) {
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
          const woNumber = await generateWONumber(
            schedule.locationId ?? asset?.locationId,
            tx,
          )

          // Build title
          let woTitle = schedule.title
          if (tier.label) woTitle += ` — ${tier.label}`
          if (asset) woTitle += ` — ${asset.name}`
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
              assetId: asset ? asset.id : null,
              locationId: schedule.locationId,
              locationScope: schedule.locationScope,
              maintenanceScheduleId: schedule.id,
              createdById: options?.userId ?? null,
              assignedToId: schedule.woAssignedToId ?? null,
              teamId: schedule.woTeamId ?? null,
              categoryId: schedule.woCategoryId ?? null,
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

          // Copy the schedule's task template into subtasks on the generated WO
          if (schedule.tasks.length > 0) {
            await tx.subtask.createMany({
              data: schedule.tasks.map(t => ({
                title:        t.title,
                order:        t.order,
                required:     t.required,
                assignedToId: t.assignedToId ?? null,
                workOrderId:  wo.id,
                createdById:  options?.userId ?? null,
              })),
            })
          }

          woIds.push(wo.id)
          woNumbers.push(woNumber)
        }
      }
    }

    currentCounter += horizon

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
        ...(schedule.triggerType === 'METER' && eligibleAssets.length > 0
          ? { lastTriggeredValue: Math.max(...eligibleAssets.map(a => a.currentMeterValue ?? 0)) }
          : {}),
      },
    })

    return { woIds, woNumbers }
  })

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
