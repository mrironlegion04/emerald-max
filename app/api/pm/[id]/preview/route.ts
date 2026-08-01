import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { advanceDate } from '@/lib/pm-generation'
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

    for (let batch = 0; batch < horizon; batch++) {
      // Calculate due date for this batch
      let dueDate: Date
      if (schedule.triggerType === 'METER') {
        dueDate = new Date()
      } else {
        const baseDate = new Date(schedule.nextDueDate)
        dueDate = batch === 0
          ? baseDate
          : advanceDate(baseDate, schedule.frequency, schedule.interval * batch)
      }

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
        if (schedule.asset) title += ` — ${schedule.asset.name}`
        else if (schedule.location) title += ` — ${schedule.location.name}`

        previewWOs.push({
          dueDate: dueDate.toISOString(),
          title,
          nestedLabel: tier.label || null,
          nestedLevel: tier.level,
        })
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
