import { prisma } from '@/lib/db'
import { createNotificationForUsers } from '@/lib/notifications'
import { writeAudit } from '@/lib/audit'
import { generateWONumber } from '@/lib/wo-number'

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
    const recipients = await getNotificationRecipients(tx, meter.assetId)
    if (recipients.length > 0) {
      await createNotificationForUsers(recipients, {
        title: `SUSPECT Reading: ${meter.name}`,
        message: `Meter reading of ${input.value} ${input.unit} flagged as SUSPECT on ${meter.asset.name}`,
        type: 'METER_ALERT',
        entityId: meter.assetId,
        href: `/assets/${meter.assetId}/meters/${input.meterId}`,
      }).catch(() => {})
    }
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
    select: {
      id: true,
      title: true,
      description: true,
      meterInterval: true,
      lastTriggeredValue: true,
      woAssignedToId: true,
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

    // Generate WO number (scoped to the asset's plant)
    const asset = await tx.asset.findUnique({
      where: { id: assetId },
      select: { locationId: true },
    })
    const woNumber = await generateWONumber(asset?.locationId, tx)

    // Create work order
    const wo = await tx.workOrder.create({
      data: {
        woNumber,
        title: `${schedule.title} (Meter: ${currentValue} ${unit})`,
        description: schedule.description,
        type: 'PREVENTIVE',
        priority: 'HIGH',
        status: 'OPEN',
        assetId,
        maintenanceScheduleId: schedule.id,
        createdById: null,
        requestedBy: 'System Generated',
      },
    })

    // Create initial status history
    await tx.workOrderStatusHistory.create({
      data: {
        workOrderId: wo.id,
        status: 'OPEN',
        changedById: null,
        changedByName: 'System',
        notes: 'Generated from PM schedule (meter trigger)',
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

    // Create notification for the assignee (if any) and plant managers/admins
    const recipients = await getNotificationRecipients(
      tx,
      assetId,
      schedule.woAssignedToId ? [schedule.woAssignedToId] : [],
    )
    if (recipients.length > 0) {
      await createNotificationForUsers(recipients, {
        title: `PM Triggered: ${schedule.title}`,
        message: `Work order created — meter ${currentValue} ${unit}`,
        type: 'PM_GENERATED',
        entityId: assetId,
        href: `/assets/${assetId}`,
      }).catch(() => {})
    }
  }
}

/**
 * Resolve notification recipients for an asset:
 * preferred IDs (if active) plus active managers/admins at the asset's plant.
 * Falls back to all active managers/admins when the asset has no location.
 */
async function getNotificationRecipients(
  tx: any,
  assetId: string,
  preferredIds: string[] = [],
): Promise<string[]> {
  const uniquePreferred = [...new Set(preferredIds.filter(Boolean))]
  const preferred = uniquePreferred.length > 0
    ? (await tx.user.findMany({
        where: { id: { in: uniquePreferred }, isActive: true },
        select: { id: true },
      })).map((u: { id: string }) => u.id)
    : []

  const asset = await tx.asset.findUnique({
    where: { id: assetId },
    select: { locationId: true },
  })

  const managers = await tx.user.findMany({
    where: {
      isActive: true,
      role: { in: ['ADMIN', 'MANAGER'] },
      ...(asset?.locationId
        ? {
            OR: [
              { role: 'ADMIN' },
              { userLocations: { some: { locationId: asset.locationId } } },
            ],
          }
        : {}),
    },
    select: { id: true },
  }).then((rows: { id: string }[]) => rows.map(r => r.id))

  return [...new Set([...preferred, ...managers])]
}
