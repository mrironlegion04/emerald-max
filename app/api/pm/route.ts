import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { buildLocationFilter, canAssignTeams, canAssignUsers, canWriteToLocations, canWriteToTeams, hasScopeActionFlag } from '@/lib/access-control'
import { computeNextDueDate } from '@/lib/pm-generation'
import { generatePMNumber } from '@/lib/wo-number'
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
  title:        z.string().min(1, 'Task title is required'),
  assignedToId: z.string().nullable().optional(),
  required:     z.boolean().default(true),
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

const pmSchema = z.object({
  title:                z.string().min(1, 'Title is required'),
  description:          z.string().nullable().optional(),
  triggerType:          z.enum(['TIME','METER','TIME_OR_METER','EVENT']).default('TIME'),
  frequency:            z.enum(['HOURLY','DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']),
  interval:             z.number().int().min(1).default(1),
  nextDueDate:          z.string().min(1, 'Next due date is required'),
  assetId:              z.string().nullable().optional(),
  assetIds:             z.array(z.string()).optional(),
  locationId:           z.string().nullable().optional(),
  locationScope:        z.enum(['ALL_ASSETS', 'GENERAL']).nullable().optional(),
  isActive:             z.boolean().default(true),
  meterInterval:        z.number().nullable().optional(),
  meterUnit:            z.string().nullable().optional(),
  meterId:              z.string().nullable().optional(),

  // MaintainX-style fields
  scheduleBehavior:     z.enum(['FIXED','FLOATING']).default('FIXED'),
  schedulingHorizon:    z.number().int().min(1).max(52).default(1),
  nestedConfig:         z.array(nestedTierSchema).nullable().optional(),
  // WO Template fields
  woPriority:           z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  woDescription:        z.string().nullable().optional(),
  woAssignedToId:       z.string().nullable().optional(),
  woTeamId:             z.string().nullable().optional(),
  woCategoryId:         z.string().nullable().optional(),
  // Start date offset
  startDateOffset:      z.number().int().min(0).default(0),
  // Nested start index
  nestedStartIndex:     z.number().int().min(0).default(0),
  // Recurrence rule (MaintWiz-style monthly rules)
  recurrenceRule:       recurrenceRuleSchema,
  occurrenceLimit:      z.number().int().min(1).nullable().optional(),
  endDate:              z.string().nullable().optional(),
  // External system ID (bulk-import dedupe)
  externalId:           z.string().nullable().optional(),
  // Task template — copied to every generated work order as subtasks
  tasks:                z.array(pmTaskSchema).optional().default([]),
}).refine(data => data.assetId || data.locationId || (data.assetIds && data.assetIds.length > 0), {
  message: "Either Asset or Location must be selected",
  path: ["assetId"]
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const locationFilter = await buildLocationFilter(user)

    const schedules = await prisma.maintenanceSchedule.findMany({
      where: locationFilter || undefined,
      include: {
        asset:    { select: { id: true, name: true, assetCode: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { nextDueDate: 'asc' },
    })
    return NextResponse.json(schedules)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'pm:create'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    if (!(await hasScopeActionFlag(user, 'canManagePM'))) {
      return NextResponse.json({ error: 'Your scope does not allow managing PM schedules' }, { status: 403 })
    }
    const body = await request.json()
    const data = pmSchema.parse(body)

    // Recurrence-aware start: snap nextDueDate to the first conformant date
    const recurrenceRule = data.recurrenceRule ?? null
    let nextDueDate = dateOnlyToUtcMidnight(data.nextDueDate)!
    if (data.recurrenceRule && data.frequency === 'MONTHLY') {
      nextDueDate = computeNextDueDate(nextDueDate, data.frequency, data.interval, data.recurrenceRule)
    }

    // Derive the full asset list: explicit assetIds wins, falls back to assetId
    const assetIds = data.assetIds && data.assetIds.length > 0
      ? data.assetIds
      : (data.assetId ? [data.assetId] : [])
    const finalAssetId = assetIds[0] ?? null

    // ── Plant scope enforcement ───────────────────────────────────────
    let assetLocationIds: (string | null)[] = []
    if (assetIds.length > 0) {
      const assets = await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { locationId: true },
      })
      assetLocationIds = assets.map(a => a.locationId)
    }

    const inScope =
      (await canWriteToLocations(user, [...(data.locationId ? [data.locationId] : []), ...assetLocationIds])) &&
      (await canAssignUsers(user, [data.woAssignedToId])) &&
      (await canAssignTeams(user, [data.woTeamId])) &&
      (await canWriteToTeams(user, [data.woTeamId])) &&
      (await canAssignUsers(user, data.tasks.map(t => t.assignedToId)))
    if (!inScope) {
      return NextResponse.json(
        { error: 'You do not have access to the selected location, asset, or assignee' },
        { status: 403 }
      )
    }

    const pmNumber = await generatePMNumber()

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        pmNumber:             pmNumber,
        title:               data.title,
        description:         data.description         ?? null,
        triggerType:         data.triggerType,
        frequency:           data.frequency,
        interval:            data.interval,
        nextDueDate:         nextDueDate,
        recurrenceRule:      recurrenceRule === null ? Prisma.JsonNull as unknown as Prisma.InputJsonValue : recurrenceRule,
        occurrenceLimit:     data.occurrenceLimit ?? null,
        endDate:             data.endDate ? dateOnlyToUtcMidnight(data.endDate) : null,
        externalId:          data.externalId ?? null,
        assetId:             finalAssetId,
        assets:              assetIds.length > 0
          ? { create: assetIds.map(assetId => ({ assetId })) }
          : undefined,
        locationId:          data.locationId           ?? null,
        locationScope:       data.locationId && !finalAssetId ? (data.locationScope ?? 'ALL_ASSETS') : null,
        isActive:            data.isActive,
        meterId:             data.meterId              ?? null,
        meterInterval:       data.meterInterval        ?? null,
        meterUnit:           data.meterUnit            ?? null,
        createdById:         user.userId,
        scheduleBehavior:    data.scheduleBehavior,
        schedulingHorizon:   data.schedulingHorizon,
        nestedConfig:        data.nestedConfig === null ? Prisma.JsonNull as any : data.nestedConfig,
        woPriority:          data.woPriority,
        woDescription:       data.woDescription        ?? null,
        woAssignedToId:      data.woAssignedToId       ?? null,
        woTeamId:            data.woTeamId              ?? null,
        woCategoryId:        data.woCategoryId          ?? null,
        startDateOffset:     data.startDateOffset,
        nestedStartIndex:    data.nestedStartIndex,
        tasks: {
          create: data.tasks.map((t, i) => ({
            title:        t.title,
            order:        i,
            assignedToId: t.assignedToId ?? null,
            required:     t.required,
          })),
        },
      },
      include: {
        tasks: { orderBy: { order: 'asc' as const } },
      },
    })

    await writeAudit({
      action: 'CREATE',
      entity: 'MaintenanceSchedule',
      entityId: schedule.id,
      entityName: schedule.title,
      userId: user.userId,
      userName: user.name,
      userEmail: user.email,
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}
