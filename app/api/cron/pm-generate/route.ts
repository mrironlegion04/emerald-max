import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateWOsForSchedule } from '@/lib/pm-generation'
import { writeAudit } from '@/lib/audit'
import { getCronSecret } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = getCronSecret()
    // Fail closed: without a valid secret, this state-changing endpoint stays locked
    if (authHeader !== `Bearer ${token}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    }

    // Find all active TIME-based schedules that are due
    const dueSchedules = await prisma.maintenanceSchedule.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        triggerType: 'TIME',
        nextDueDate: { lte: now },
      },
      select: { id: true, title: true, schedulingHorizon: true },
    })

    for (const schedule of dueSchedules) {
      try {
        const result = await generateWOsForSchedule(schedule.id, {
          userId: undefined,
          horizon: schedule.schedulingHorizon ?? 1,
        })
        if (result.workOrderIds.length > 0) {
          results.created += result.workOrderIds.length
        } else {
          results.skipped++
        }
        if (result.errors.length > 0) {
          results.errors.push(`${schedule.title}: ${result.errors.join(', ')}`)
        }
      } catch (err) {
        results.errors.push(`${schedule.title}: ${err}`)
      }
    }

    // Also handle METER-based schedules that have crossed their threshold
    const meterSchedules = await prisma.maintenanceSchedule.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        triggerType: 'METER',
        meterId: { not: null },
        meterInterval: { not: null },
      },
      include: {
        asset: { select: { id: true, currentMeterValue: true } },
      },
    })

    for (const schedule of meterSchedules) {
      if (!schedule.meterInterval || !schedule.asset?.currentMeterValue) continue
      const lastTriggered = schedule.lastTriggeredValue ?? 0
      if (schedule.asset.currentMeterValue - lastTriggered < schedule.meterInterval) continue

      // Check for duplicate: existing OPEN or IN_PROGRESS WO for this asset
      const existingWO = await prisma.workOrder.findFirst({
        where: {
          assetId: schedule.assetId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL'] },
          type: 'PREVENTIVE',
        },
        select: { woNumber: true },
      })
      if (existingWO) {
        results.skipped++
        continue
      }

      try {
        const result = await generateWOsForSchedule(schedule.id, {
          userId: undefined,
          horizon: schedule.schedulingHorizon ?? 1,
        })
        if (result.workOrderIds.length > 0) {
          results.created += result.workOrderIds.length
        } else {
          results.skipped++
        }
      } catch (err) {
        results.errors.push(`${schedule.title}: ${err}`)
      }
    }

    // Also handle TIME_OR_METER schedules — fire if EITHER time OR meter condition is met
    const timeOrMeterSchedules = await prisma.maintenanceSchedule.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        triggerType: 'TIME_OR_METER',
      },
      include: {
        asset: { select: { id: true, currentMeterValue: true } },
      },
    })

    for (const schedule of timeOrMeterSchedules) {
      const timeDue = schedule.nextDueDate <= now
      const lastTriggered = schedule.lastTriggeredValue ?? 0
      const meterCrossed = schedule.meterInterval != null
        && schedule.asset?.currentMeterValue != null
        && schedule.asset.currentMeterValue - lastTriggered >= schedule.meterInterval

      if (!timeDue && !meterCrossed) continue

      // Check for duplicate: existing OPEN or IN_PROGRESS WO for this asset
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
          results.skipped++
          continue
        }
      }

      try {
        const result = await generateWOsForSchedule(schedule.id, {
          userId: undefined,
          horizon: schedule.schedulingHorizon ?? 1,
        })
        if (result.workOrderIds.length > 0) {
          results.created += result.workOrderIds.length
        } else {
          results.skipped++
        }
      } catch (err) {
        results.errors.push(`${schedule.title}: ${err}`)
      }
    }

    await writeAudit({
      action: 'CRON_GENERATE',
      entity: 'MaintenanceSchedule',
      entityId: 'batch',
      entityName: `PM Cron: ${results.created} WOs created, ${results.skipped} skipped`,
      userId: 'system',
      userName: 'Cron Job',
      userEmail: '',
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('PM cron generation failed:', error)
    return NextResponse.json(
      { error: 'Cron generation failed' },
      { status: 500 },
    )
  }
}
