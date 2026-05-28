import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import { writeAudit } from '@/lib/audit'

export interface MeterReadingInput {
  value: number
  readingDate: Date
  notes?: string | null
  source?: 'MANUAL' | 'IOT' | 'IMPORT'
  recordedById?: string | null
  recordedBy?: string | null
}

export interface MeterEventPayload {
  meterId: string
  assetId: string
  readingId: string
  value: number
  previousValue: number | null
  delta: number | null
  source: string
  status: string
}

export async function emitMeterEvent(
  tx: any,
  eventType: string,
  meterId: string,
  readingId: string | null,
  payload: Record<string, unknown>,
) {
  await tx.meterEvent.create({
    data: {
      eventType,
      meterId,
      readingId,
      payload: payload as any,
    },
  })
}

/**
 * Process a reading after creation:
 * 1. CacheProcessor — update Meter.lastValue, Meter.lastReadingAt
 * 2. PMTriggerProcessor — check thresholds, create WO
 * 3. NotificationProcessor — send alerts
 * 4. AuditProcessor — write audit log
 */
export async function processMeterReading(
  tx: any,
  input: {
    meterId: string
    readingId: string
    value: number
    unit: string
    readingDate: Date
    source: string
    status: string
    recordedById?: string | null
    recordedBy?: string | null
  },
) {
  const meter = await tx.meter.findUnique({
    where: { id: input.meterId },
    include: { asset: { select: { id: true, name: true } } },
  })
  if (!meter) return

  const previousValue = meter.lastValue
  const delta = previousValue !== null ? input.value - previousValue : null

  // 1. CacheProcessor — update Meter cache
  await tx.meter.update({
    where: { id: input.meterId },
    data: {
      lastValue: input.value,
      lastReadingAt: input.readingDate,
    },
  })

  // Sync to Asset legacy cache if this is the primary meter
  if (meter.isPrimary) {
    await tx.asset.update({
      where: { id: meter.assetId },
      data: {
        currentMeterValue: input.value,
        meterUnit: input.unit,
      },
    })
  }

  // 2. Emit READING_CREATED event
  await emitMeterEvent(tx, 'READING_CREATED', input.meterId, input.readingId, {
    value: input.value,
    previousValue,
    delta,
    source: input.source,
    status: input.status,
  })

  // 3. PMTriggerProcessor — check thresholds
  if (input.status !== 'REJECTED') {
    await triggerPMSchedules(tx, input.meterId, meter.assetId, input.value, meter.unit)
  }

  // 4. NotificationProcessor — alert on SUSPECT status
  if (input.status === 'SUSPECT') {
    await createNotification({
      userId: 'admin',
      title: `SUSPECT Reading: ${meter.name}`,
      message: `Meter reading of ${input.value} ${input.unit} flagged as SUSPECT on ${meter.asset.name}`,
      type: 'METER_ALERT',
      entityId: meter.assetId,
      href: `/assets/${meter.assetId}/meters/${input.meterId}`,
    }).catch(() => {})
  }

  // 5. Audit
  await writeAudit({
    action: 'CREATE',
    entity: 'MeterReading',
    entityId: input.readingId,
    entityName: `${meter.asset.name} - ${meter.name}: ${input.value} ${input.unit}`,
    userId: input.recordedById ?? 'system',
    userName: input.recordedBy ?? 'System',
    userEmail: '',
  })
}

/**
 * PM trigger: find schedules for this meter and create WO if threshold is crossed.
 * Uses lastTriggeredValue to prevent re-triggering on every reading.
 */
async function triggerPMSchedules(
  tx: any,
  meterId: string,
  assetId: string,
  currentValue: number,
  unit: string,
) {
  const schedules = await tx.maintenanceSchedule.findMany({
    where: {
      meterId,
      isActive: true,
      triggerType: 'METER',
      meterInterval: { not: null },
    },
  })

  for (const schedule of schedules) {
    const interval = schedule.meterInterval!
    const lastTriggered = schedule.lastTriggeredValue ?? 0
    const delta = currentValue - lastTriggered

    // Only trigger when delta meets or exceeds the interval
    if (delta < interval) continue

    // Check no existing WO for this schedule in the last 24h
    const existingWO = await tx.workOrder.findFirst({
      where: {
        assetId,
        title: { contains: schedule.title },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    })

    if (existingWO) continue

    // Generate WO number
    const lastWO = await tx.workOrder.findFirst({
      orderBy: { woNumber: 'desc' },
      select: { woNumber: true },
    })
    let nextNum = 1
    if (lastWO?.woNumber) {
      const num = parseInt(lastWO.woNumber.replace('WO-', ''), 10)
      if (!isNaN(num)) nextNum = num + 1
    }

    // Create work order
    await tx.workOrder.create({
      data: {
        woNumber: `WO-${String(nextNum).padStart(4, '0')}`,
        title: `${schedule.title} (Meter: ${currentValue} ${unit})`,
        description: schedule.description,
        type: 'PREVENTIVE',
        priority: 'HIGH',
        status: 'OPEN',
        assetId,
        maintenanceScheduleId: schedule.id,
        createdById: 'system',
      },
    })

    // Update lastTriggeredValue
    await tx.maintenanceSchedule.update({
      where: { id: schedule.id },
      data: { lastTriggeredValue: currentValue },
    })

    // Emit PM_TRIGGERED event
    await emitMeterEvent(tx, 'PM_TRIGGERED', meterId, null, {
      scheduleId: schedule.id,
      scheduleTitle: schedule.title,
      threshold: interval,
      currentValue,
      lastTriggered,
      delta,
    })

    // Create notification
    await createNotification({
      userId: 'admin',
      title: `PM Triggered: ${schedule.title}`,
      message: `Work order created — meter ${currentValue} ${unit}`,
      type: 'PM_GENERATED',
      entityId: assetId,
      href: `/assets/${assetId}`,
    }).catch(() => {})
  }
}
