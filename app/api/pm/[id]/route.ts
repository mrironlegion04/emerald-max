import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { buildLocationFilter, canAssignTeams, canAssignUsers, canWriteToLocations, canWriteToTeams, hasScopeActionFlag } from '@/lib/access-control'
import { computeNextDueDate, type RecurrenceRule } from '@/lib/pm-generation'
import { dateOnlyToUtcMidnight } from '@/lib/date-format'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const nestedTierSchema = z.object({
  label:     z.string(),
  frequency: z.enum(['HOURLY','DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']),
  interval:  z.number().int().min(1),
  runEvery:  z.number().int().min(1),
  enabled:   z.boolean(),
})

const pmTaskSchema = z.object({
  title:          z.string().min(1, 'Task title is required'),
  description:    z.string().nullable().optional(),
  priority:       z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  assignedToId:   z.string().nullable().optional(),
  assignedTeamId: z.string().nullable().optional(),
  required:       z.boolean().default(true),
})

const recurrenceRuleSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('NTH_WEEKDAY'),
      dayOfWeek: z.number().int().min(0).max(6),
      occurrence: z.number().int().refine(v => v === -1 || (v >= 1 && v <= 5), 'Occurrence must be -1 (last) or 1-5'),
    }),
    z.object({
      type: z.literal('DAY_OF_MONTH'),
      dayOfMonth: z.number().int().min(-1).max(31),
    }),
  ])
  .nullable()
  .optional()

const updateSchema = z.object({
  title:                z.string().min(1).optional(),
  description:          z.string().nullable().optional(),
  triggerType:          z.enum(['TIME','METER','TIME_OR_METER','EVENT']).optional(),
  frequency:            z.enum(['HOURLY','DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']).optional(),
  interval:             z.number().int().min(1).optional(),
  nextDueDate:          z.string().optional(),
  assetId:              z.string().nullable().optional(),
  assetIds:             z.array(z.string()).optional(),
  locationId:           z.string().nullable().optional(),
  locationScope:        z.enum(['ALL_ASSETS', 'GENERAL']).nullable().optional(),
  isActive:             z.boolean().optional(),
  meterInterval:        z.number().nullable().optional(),
  meterUnit:            z.string().nullable().optional(),
  meterId:              z.string().nullable().optional(),
  procedureIds:         z.array(z.string()).optional(),
  // MaintainX-style fields
  scheduleBehavior:     z.enum(['FIXED','FLOATING']).optional(),
  schedulingHorizon:    z.number().int().min(1).max(52).optional(),
  nestedConfig:         z.array(nestedTierSchema).nullable().optional(),
  // WO Template fields
  woPriority:           z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  woDescription:        z.string().nullable().optional(),
  woAssignedToId:       z.string().nullable().optional(),
  woTeamId:             z.string().nullable().optional(),
  // Start date offset
  startDateOffset:      z.number().int().min(0).optional(),
  // Nested start index
  nestedStartIndex:     z.number().int().min(0).optional(),
  // Recurrence rule (MaintWiz-style monthly rules)
  recurrenceRule:       recurrenceRuleSchema,
  occurrenceLimit:      z.number().int().min(1).nullable().optional(),
  endDate:              z.string().nullable().optional(),
  // External system ID (bulk-import dedupe)
  externalId:           z.string().nullable().optional(),
  // Task template — replace-all semantics when provided
  tasks:                z.array(pmTaskSchema).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const schedule = await prisma.maintenanceSchedule.findUnique({
      where: { id },
      include: {
        asset: true,
        assets: { include: { asset: true } },
        location: true,
        tasks: {
          orderBy: { order: 'asc' as const },
          include: {
            assignedTo: { select: { id: true, name: true } },
            assignedTeam: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!schedule) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const locationFilter = await buildLocationFilter(user)
    if (locationFilter && (!schedule.locationId || !(locationFilter.locationId as { in: string[] }).in.includes(schedule.locationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:edit'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!(await hasScopeActionFlag(user, 'canManagePM'))) {
      return NextResponse.json({ error: 'Your scope does not allow managing PM schedules' }, { status: 403 })
    }
    const { id } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const locationFilter = await buildLocationFilter(user)
    if (locationFilter && (!existing.locationId || !(locationFilter.locationId as { in: string[] }).in.includes(existing.locationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Derive the full asset list: explicit assetIds wins, then assetId, else keep existing
    const existingAssetRows = await prisma.maintenanceScheduleAsset.findMany({
      where: { scheduleId: id },
      select: { assetId: true },
    })
    const existingAssetIds = existingAssetRows.map(r => r.assetId)

    const finalAssetIds =
      data.assetIds !== undefined
        ? data.assetIds
        : (data.assetId !== undefined
            ? (data.assetId ? [data.assetId] : [])
            : existingAssetIds)

    const finalAssetId = finalAssetIds[0] ?? null
    const finalLocationId = data.locationId !== undefined ? data.locationId : existing.locationId
    const finalLocationScope = finalLocationId && !finalAssetId
      ? (data.locationScope !== undefined ? data.locationScope : (existing.locationScope ?? 'ALL_ASSETS'))
      : null

    // ── Plant scope enforcement (only for fields actually changed) ────
    const changedLocationIds: (string | null | undefined)[] = []
    if (data.locationId !== undefined) changedLocationIds.push(finalLocationId)
    if (data.assetIds !== undefined || data.assetId !== undefined) {
      const assetLocationRows = finalAssetIds.length > 0
        ? await prisma.asset.findMany({ where: { id: { in: finalAssetIds } }, select: { locationId: true } })
        : []
      changedLocationIds.push(...assetLocationRows.map(a => a.locationId))
    }

    const inScope =
      (await canWriteToLocations(user, changedLocationIds)) &&
      (data.woAssignedToId !== undefined ? await canAssignUsers(user, [data.woAssignedToId]) : true) &&
      (data.woTeamId !== undefined ? await canAssignTeams(user, [data.woTeamId]) : true) &&
      (data.woTeamId !== undefined ? await canWriteToTeams(user, [data.woTeamId]) : true) &&
      (data.tasks !== undefined ? await canAssignUsers(user, data.tasks.map(t => t.assignedToId)) : true)
    if (!inScope) {
      return NextResponse.json(
        { error: 'You do not have access to the selected location, asset, or assignee' },
        { status: 403 }
      )
    }

    // Recurrence-aware start: snap nextDueDate to the first conformant date
    const recurrenceRule = data.recurrenceRule !== undefined
      ? data.recurrenceRule
      : ((existing.recurrenceRule ?? null) as unknown as RecurrenceRule | null)
    const effectiveFrequency = data.frequency ?? existing.frequency
    const effectiveInterval = data.interval ?? existing.interval
    let nextDueDate = data.nextDueDate ? dateOnlyToUtcMidnight(data.nextDueDate)! : existing.nextDueDate
    if (recurrenceRule && effectiveFrequency === 'MONTHLY') {
      nextDueDate = computeNextDueDate(nextDueDate, effectiveFrequency, effectiveInterval, recurrenceRule)
    }

    const schedule = await prisma.$transaction(async tx => {
      if (data.tasks !== undefined) {
        await tx.pmScheduleTask.deleteMany({ where: { scheduleId: id } })
        await tx.pmScheduleTask.createMany({
          data: data.tasks.map((t, i) => ({
            title:           t.title,
            description:     t.description ?? null,
            priority:        t.priority,
            order:           i,
            assignedToId:    t.assignedToId ?? null,
            assignedTeamId:  t.assignedTeamId ?? null,
            required:        t.required,
            scheduleId:      id,
          })),
        })
      }
      if (data.assetIds !== undefined || data.assetId !== undefined) {
        await tx.maintenanceScheduleAsset.deleteMany({ where: { scheduleId: id } })
        if (finalAssetIds.length > 0) {
          await tx.maintenanceScheduleAsset.createMany({
            data: finalAssetIds.map(assetId => ({ scheduleId: id, assetId })),
          })
        }
      }
      return tx.maintenanceSchedule.update({
        where: { id },
        data: {
          title:               data.title,
          description:         data.description         ?? undefined,
          triggerType:         data.triggerType,
          frequency:           data.frequency,
          interval:            data.interval,
          nextDueDate:         nextDueDate,
          recurrenceRule:      data.recurrenceRule !== undefined
            ? (recurrenceRule === null ? Prisma.JsonNull as unknown as Prisma.InputJsonValue : recurrenceRule)
            : undefined,
          occurrenceLimit:     data.occurrenceLimit !== undefined
            ? data.occurrenceLimit
            : undefined,
          endDate:             data.endDate !== undefined
            ? (data.endDate ? dateOnlyToUtcMidnight(data.endDate) : null)
            : undefined,
          externalId:          data.externalId !== undefined
            ? data.externalId
            : undefined,
          assetId:             finalAssetId,
          locationId:          finalLocationId,
          locationScope:       finalLocationScope,
          isActive:            data.isActive,
          meterId:             data.meterId              ?? null,
          meterInterval:       data.meterInterval        ?? null,
          meterUnit:           data.meterUnit            ?? null,
          scheduleBehavior:    data.scheduleBehavior,
          schedulingHorizon:   data.schedulingHorizon,
          nestedConfig:        data.nestedConfig !== undefined
            ? (data.nestedConfig === null ? Prisma.JsonNull as any : data.nestedConfig)
            : undefined,
          woPriority:          data.woPriority,
          woDescription:       data.woDescription        ?? undefined,
          woAssignedToId:      data.woAssignedToId       ?? undefined,
          woTeamId:            data.woTeamId              ?? undefined,
          startDateOffset:     data.startDateOffset,
          nestedStartIndex:    data.nestedStartIndex,
        },
      })
    })

    const changes: Record<string, { before: any; after: any }> = {}
    for (const key of Object.keys(data)) {
      const beforeVal = existing[key as keyof typeof existing]
      const afterVal = schedule[key as keyof typeof schedule]
      const beforeStr = beforeVal instanceof Date ? beforeVal.toISOString() : JSON.stringify(beforeVal)
      const afterStr = afterVal instanceof Date ? afterVal.toISOString() : JSON.stringify(afterVal)
      if (beforeStr !== afterStr) {
        changes[key] = {
          before: beforeVal instanceof Date ? beforeVal.toISOString() : beforeVal,
          after: afterVal instanceof Date ? afterVal.toISOString() : afterVal
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      await writeAudit({
        action: 'UPDATE',
        entity: 'MaintenanceSchedule',
        entityId: schedule.id,
        entityName: schedule.title,
        changes,
        userId: user.userId,
        userName: user.name,
        userEmail: user.email,
      })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:delete'))) {
      return NextResponse.json({ error: 'Only admins can delete schedules' }, { status: 403 })
    }
    if (!(await hasScopeActionFlag(user, 'canManagePM'))) {
      return NextResponse.json({ error: 'Your scope does not allow managing PM schedules' }, { status: 403 })
    }
    const { id } = await params
    const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const locationFilter = await buildLocationFilter(user)
    if (locationFilter && (!existing.locationId || !(locationFilter.locationId as { in: string[] }).in.includes(existing.locationId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.maintenanceSchedule.delete({ where: { id } })

    await writeAudit({
      action: 'DELETE',
      entity: 'MaintenanceSchedule',
      entityId: id,
      entityName: existing.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
  }
}
