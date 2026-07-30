import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { hasPermission } from '@/lib/permissions'
import { writeAudit } from '@/lib/audit'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

const nestedTierSchema = z.object({
  label:     z.string(),
  frequency: z.enum(['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']),
  interval:  z.number().int().min(1),
  runEvery:  z.number().int().min(1),
  enabled:   z.boolean(),
})

const pmSchema = z.object({
  title:                z.string().min(1, 'Title is required'),
  description:          z.string().nullable().optional(),
  triggerType:          z.enum(['TIME','METER','TIME_OR_METER']).default('TIME'),
  frequency:            z.enum(['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY']),
  interval:             z.number().int().min(1).default(1),
  nextDueDate:          z.string().min(1, 'Next due date is required'),
  assetId:              z.string().nullable().optional(),
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
}).refine(data => data.assetId || data.locationId, {
  message: "Either Asset or Location must be selected",
  path: ["assetId"]
})

export async function GET() {
  try {
    const schedules = await prisma.maintenanceSchedule.findMany({
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
    const body = await request.json()
    const data = pmSchema.parse(body)

    const schedule = await prisma.maintenanceSchedule.create({
      data: {
        title:               data.title,
        description:         data.description         ?? null,
        triggerType:         data.triggerType,
        frequency:           data.frequency,
        interval:            data.interval,
        nextDueDate:         new Date(data.nextDueDate),
        assetId:             data.assetId              ?? null,
        locationId:          data.locationId           ?? null,
        locationScope:       data.locationId && !data.assetId ? (data.locationScope ?? 'ALL_ASSETS') : null,
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
