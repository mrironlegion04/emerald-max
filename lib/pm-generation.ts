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

// ── Recurrence Rules (MaintWiz-style monthly rules) ─────────────────────
// NTH_WEEKDAY: "The {occurrence} {dayOfWeek} of every N month(s)"
//   occurrence: 1-5 (1st, 2nd, … 5th) or -1 (last)
//   dayOfWeek: 0=Sunday … 6=Saturday
// DAY_OF_MONTH: "The {dayOfMonth} of every N month(s)"
//   dayOfMonth: 1-31 (clamped to month length) or -1 (last day)

export type RecurrenceRule =
  | { type: 'NTH_WEEKDAY'; dayOfWeek: number; occurrence: number }
  | { type: 'DAY_OF_MONTH'; dayOfMonth: number }

function nthWeekdayDate(year: number, month: number, dayOfWeek: number, occurrence: number): Date {
  const lastDayNum = new Date(year, month + 1, 0).getDate()
  if (occurrence === -1) {
    const lastDow = new Date(year, month, lastDayNum).getDay()
    return new Date(year, month, lastDayNum - ((lastDow - dayOfWeek + 7) % 7))
  }
  const firstDow = new Date(year, month, 1).getDay()
  let day = 1 + ((dayOfWeek - firstDow + 7) % 7) + (occurrence - 1) * 7
  if (day > lastDayNum) day -= 7 // 5th weekday doesn't exist → use the last one
  return new Date(year, month, day)
}

function dayOfMonthDate(year: number, month: number, dayOfMonth: number): Date {
  const lastDayNum = new Date(year, month + 1, 0).getDate()
  const day = dayOfMonth === -1 ? lastDayNum : Math.min(dayOfMonth, lastDayNum)
  return new Date(year, month, day)
}

function dateForRule(year: number, month: number, rule: RecurrenceRule): Date {
  if (rule.type === 'NTH_WEEKDAY') {
    return nthWeekdayDate(year, month, rule.dayOfWeek, rule.occurrence)
  }
  return dayOfMonthDate(year, month, rule.dayOfMonth)
}

// First recurrence-conformant date on or after `date` (monthly rules only)
export function snapToRecurrence(date: Date, rule: RecurrenceRule): Date {
  const candidate = dateForRule(date.getFullYear(), date.getMonth(), rule)
  if (candidate.getTime() >= date.getTime()) return candidate
  const targetMonth = date.getMonth() + 1
  const year = date.getFullYear() + Math.floor(targetMonth / 12)
  const monthInYear = ((targetMonth % 12) + 12) % 12
  return dateForRule(year, monthInYear, rule)
}

// Compute the initial nextDueDate for a schedule from its start date.
// With a monthly recurrence rule, snaps to the first conformant date.
export function computeNextDueDate(
  startDate: Date,
  frequency: string,
  _interval: number,
  recurrenceRule?: RecurrenceRule | null,
): Date {
  if (recurrenceRule && frequency === 'MONTHLY') {
    return snapToRecurrence(startDate, recurrenceRule)
  }
  return startDate
}

// ── Date Utilities (with month-overflow fix) ────────────────────────────

export function advanceDate(
  current: Date,
  frequency: string,
  interval: number,
  recurrenceRule?: RecurrenceRule | null,
): Date {
  const next = new Date(current)
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + interval)
      break
    case 'WEEKLY':
      next.setDate(next.getDate() + interval * 7)
      break
    case 'MONTHLY':
      if (recurrenceRule) {
        const targetMonth = next.getMonth() + interval
        const targetYear = next.getFullYear() + Math.floor(targetMonth / 12)
        const monthInYear = ((targetMonth % 12) + 12) % 12
        return dateForRule(targetYear, monthInYear, recurrenceRule)
      }
      {
        const targetMonth = next.getMonth() + interval
        const targetYear = next.getFullYear() + Math.floor(targetMonth / 12)
        const monthInYear = ((targetMonth % 12) + 12) % 12
        const lastDay = new Date(targetYear, monthInYear + 1, 0).getDate()
        next.setDate(Math.min(next.getDate(), lastDay))
        next.setMonth(monthInYear)
        next.setFullYear(targetYear)
      }
      break
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
    const recurrence = (schedule.recurrenceRule ?? null) as RecurrenceRule | null

    // Precompute per-batch due dates (stepwise so recurrence rules apply per step)
    const batchDates: Date[] = []
    {
      let due = new Date(schedule.nextDueDate)
      for (let b = 0; b < horizon; b++) {
        if (schedule.triggerType === 'METER') {
          batchDates.push(new Date())
        } else if (b === 0) {
          batchDates.push(new Date(due))
        } else {
          due = advanceDate(due, schedule.frequency, schedule.interval, recurrence)
          batchDates.push(new Date(due))
        }
      }
    }

    // Honor occurrence limit + end date — compute which batches may generate
    const startingCount = schedule.occurrenceCount ?? 0
    const eligibleBatches: number[] = []
    for (let b = 0; b < batchDates.length; b++) {
      if (schedule.endDate && batchDates[b] > new Date(schedule.endDate)) break
      if (schedule.occurrenceLimit != null && startingCount + eligibleBatches.length >= schedule.occurrenceLimit) break
      eligibleBatches.push(b)
    }

    // Generate WOs in a transaction
    const generated = await prisma.$transaction(async tx => {
      const woIds: string[] = []
      const woNumbers: string[] = []
      let currentCounter = schedule.nestedCounter ?? 0
      const eligibleAssets = targetAssets.filter(a => !skippedAssets.has(a.id))
      const targets: (typeof eligibleAssets[number] | null)[] =
        eligibleAssets.length > 0 ? eligibleAssets : [null]

      for (const asset of targets) {
        for (const batch of eligibleBatches) {
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

            // Due date for this batch (precomputed)
            const dueDate = batchDates[batch]

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

    currentCounter += eligibleBatches.length

    // Advance nextDueDate (for fixed intervals, advance stepwise from current due date)
    let nextDue: Date | null = null
    if (schedule.triggerType === 'TIME' && schedule.scheduleBehavior === 'FIXED') {
      nextDue = new Date(schedule.nextDueDate)
      for (let i = 0; i < eligibleBatches.length; i++) {
        nextDue = advanceDate(nextDue, schedule.frequency, schedule.interval, recurrence)
      }
    }
    // For FLOATING: nextDue is advanced when the WO is completed (handled in handleWOCompletion)
    // For METER: don't advance the date
    // For TIME_OR_METER with fixed: advance by the eligible batches

    const newOccurrenceCount = startingCount + eligibleBatches.length
    const reachedLimit = schedule.occurrenceLimit != null
      && newOccurrenceCount >= schedule.occurrenceLimit
    const pastEnd = schedule.endDate != null
      && eligibleBatches.length === 0
      && batchDates.length > 0
      && batchDates[0] > new Date(schedule.endDate)

    await tx.maintenanceSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(nextDue ? { nextDueDate: nextDue } : {}),
        nestedCounter: currentCounter,
        occurrenceCount: newOccurrenceCount,
        ...(reachedLimit || pastEnd ? { isActive: false } : {}),
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
      recurrenceRule: true,
      endDate: true,
    },
  })
  if (!schedule || schedule.scheduleBehavior !== 'FLOATING') return

  // Reschedule from completion date
  const completedAt = new Date()
  const recurrence = (schedule.recurrenceRule ?? null) as RecurrenceRule | null
  const nextDue = advanceDate(completedAt, schedule.frequency, schedule.interval, recurrence)

  const pastEnd = schedule.endDate != null
    && nextDue > new Date(schedule.endDate)

  await prisma.maintenanceSchedule.update({
    where: { id: wo.maintenanceScheduleId },
    data: {
      lastCompletedAt: completedAt,
      nextDueDate: nextDue,
      ...(pastEnd ? { isActive: false } : {}),
    },
  })
}
