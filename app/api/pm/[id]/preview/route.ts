import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { advanceDate, type RecurrenceRule } from '@/lib/pm-generation'
import { buildLocationFilter } from '@/lib/access-control'

interface PreviewWO {
  dueDate: string
  title: string
  nestedLabel: string | null
  nestedLevel: number
}

interface NestedPMConfig {
  label: string
  frequency: string
  interval: number
  runEvery: number
  enabled: boolean
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        asset: { select: { id: true, name: true } },
        assets: { include: { asset: { select: { id: true, name: true } } } },
        location: { select: { id: true, name: true } },
      },
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const locationFilter = await buildLocationFilter(user)
    if (locationFilter && (!schedule.locationId || !(locationFilter.locationId as { in: string[] }).in.includes(schedule.locationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const horizon = schedule.schedulingHorizon ?? 1
    const previewWOs: PreviewWO[] = []
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

    // Honor occurrence limit + end date
    const startingCount = schedule.occurrenceCount ?? 0
    const eligibleBatches: number[] = []
    for (let b = 0; b < batchDates.length; b++) {
      if (schedule.endDate && batchDates[b] > new Date(schedule.endDate)) break
      if (schedule.occurrenceLimit != null && startingCount + eligibleBatches.length >= schedule.occurrenceLimit) break
      eligibleBatches.push(b)
    }

    // Resolve target assets: junction rows win, fall back to the legacy single assetId
    const targetAssets = schedule.assets.length > 0
      ? schedule.assets.map(a => a.asset)
      : (schedule.asset ? [schedule.asset] : [])
    const targets: ({ id: string; name: string } | null)[] =
      targetAssets.length > 0 ? targetAssets : [null]

    for (const asset of targets) {
      for (const batch of eligibleBatches) {
        // Due date for this batch (precomputed)
        const dueDate = batchDates[batch]

        // Build tiers for this batch
        const counter = baseCounter + batch
        const tiers: { label: string; level: number }[] = [
          { label: '', level: 0 },
        ]

        if (schedule.nestedConfig && Array.isArray(schedule.nestedConfig)) {
          const nestedArr = schedule.nestedConfig as unknown as NestedPMConfig[]
          for (let i = 0; i < nestedArr.length; i++) {
            const nested = nestedArr[i]
            if (!nested.enabled) continue
            const runEvery = nested.runEvery ?? 1
            if (counter % runEvery === 0) {
              tiers.push({
                label: nested.label,
                level: i + 1,
              })
            }
          }
        }

        // Create preview WOs for each tier
        for (const tier of tiers) {
          let title = schedule.title
          if (tier.label) title += ` — ${tier.label}`
          if (asset) title += ` — ${asset.name}`
          else if (schedule.location) title += ` — ${schedule.location.name}`

          previewWOs.push({
            dueDate: dueDate.toISOString(),
            title,
            nestedLabel: tier.label || null,
            nestedLevel: tier.level,
          })
        }
      }
    }

    return NextResponse.json(previewWOs)
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 },
    )
  }
}
